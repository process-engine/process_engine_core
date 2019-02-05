import {IContainer} from 'addict-ioc';

import {InternalServerError} from '@essential-projects/errors_ts';
import {EventReceivedCallback, Subscription} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';
import {
  eventAggregatorSettings,
  IBoundaryEventHandler,
  IBoundaryEventHandlerFactory,
  IFlowNodeHandler,
  IInterruptible,
  IProcessModelFacade,
  IProcessTokenFacade,
  Model,
  OnBoundaryEventTriggeredCallback,
  OnBoundaryEventTriggeredData,
  onInterruptionCallback,
  Runtime,
  TerminateEndEventReachedMessage,
} from '@process-engine/process_engine_contracts';

import {ErrorBoundaryEventHandler} from './boundary_event_handlers/index';
import {FlowNodeHandler} from './flow_node_handler';

export abstract class FlowNodeHandlerInterruptible<TFlowNode extends Model.Base.FlowNode>
  extends FlowNodeHandler<TFlowNode>
  implements IInterruptible {

  private _attachedBoundaryEventHandlers: Array<IBoundaryEventHandler> = [];
  private _boundaryEventHandlerFactory: IBoundaryEventHandlerFactory;

  private _terminationSubscription: Subscription;
  private _onInterruptedCallback: onInterruptionCallback;

  constructor(container: IContainer, flowNode: TFlowNode) {
    super(container, flowNode);
    // tslint:disable-next-line:no-empty
    this._onInterruptedCallback = (): void => {};
  }

  /**
   * Gets the callback that gets called when an interrupt-command was received.
   * This can be used by the derived handlers to perform handler-specific actions
   * necessary for stopping its work cleanly.
   *
   * Interruptions are currently done, when a TerminateEndEvent was reached, or
   * an interrupting BoundaryEvent was triggered.
   */
  protected get onInterruptedCallback(): onInterruptionCallback {
    return this._onInterruptedCallback;
  }

  /**
   * Sets the callback that gets called when an interrupt-command was received.
   */
  protected set onInterruptedCallback(value: onInterruptionCallback) {
    this._onInterruptedCallback = value;
  }

  public async initialize(): Promise<void> {
    await super.initialize();
    this._boundaryEventHandlerFactory = await this._container.resolveAsync<IBoundaryEventHandlerFactory>('BoundaryEventHandlerFactory');
  }

  protected async beforeExecute(
    token: Runtime.Types.ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<void> {
    this._terminationSubscription = this._subscribeToProcessTermination(token);
    await this._attachBoundaryEvents(token, processTokenFacade, processModelFacade, identity);
  }

  protected async afterExecute(): Promise<void> {
    this.eventAggregator.unsubscribe(this._terminationSubscription);
    await this._detachBoundaryEvents();
  }

  public async execute(
    token: Runtime.Types.ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
    previousFlowNodeInstanceId?: string,
  ): Promise<void> {

    try {
      await super.execute(token, processTokenFacade, processModelFacade, identity);
    } catch (error) {
      const errorBoundaryEvents: Array<ErrorBoundaryEventHandler> = this._findErrorBoundaryEventHandlersForError(error);

      const noErrorBoundaryEventsAvailable: boolean = !errorBoundaryEvents || errorBoundaryEvents.length === 0;
      if (noErrorBoundaryEventsAvailable) {
        throw error;
      }

      token.payload = error;

      await Promise.map(errorBoundaryEvents, async(boundaryEventHandler: ErrorBoundaryEventHandler) => {
        const flowNodeAfterBoundaryEvent: Model.Base.FlowNode = boundaryEventHandler.getNextFlowNode();
        await this._continueAfterBoundaryEvent(flowNodeAfterBoundaryEvent, token, processTokenFacade, processModelFacade, identity);
      });
    }
  }

  public async resume(
    flowNodeInstances: Array<Runtime.Types.FlowNodeInstance>,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<void> {

    try {
      await super.resume(flowNodeInstances, processTokenFacade, processModelFacade, identity);
    } catch (error) {
      const errorBoundaryEvents: Array<ErrorBoundaryEventHandler> = this._findErrorBoundaryEventHandlersForError(error);

      const noErrorBoundaryEventsAvailable: boolean = !errorBoundaryEvents || errorBoundaryEvents.length === 0;
      if (noErrorBoundaryEventsAvailable) {
        throw error;
      }

      const token: Runtime.Types.ProcessToken = processTokenFacade.createProcessToken();
      token.payload = error;
      token.flowNodeInstanceId = this.flowNodeInstanceId;

      await Promise.map(errorBoundaryEvents, async(boundaryEventHandler: ErrorBoundaryEventHandler) => {
        const flowNodeAfterBoundaryEvent: Model.Base.FlowNode = boundaryEventHandler.getNextFlowNode();
        await this._continueAfterBoundaryEvent(flowNodeAfterBoundaryEvent, token, processTokenFacade, processModelFacade, identity);
      });
    }
  }

  public async interrupt(token: Runtime.Types.ProcessToken, terminate?: boolean): Promise<void> {
    await this.onInterruptedCallback(token);

    if (terminate) {
      await this.persistOnTerminate(token);
      throw new InternalServerError(`Process was terminated!`);
    }

    return this.persistOnExit(token);
  }

  private _subscribeToProcessTermination(token: Runtime.Types.ProcessToken): Subscription {

    const terminateEvent: string = eventAggregatorSettings.messagePaths.terminateEndEventReached
      .replace(eventAggregatorSettings.messageParams.processInstanceId, token.processInstanceId);

    const onTerminatedCallback: EventReceivedCallback = async(message: TerminateEndEventReachedMessage): Promise<void> => {

      this.logger.error(`Process was terminated through TerminateEndEvent '${message.flowNodeId}'!`);

      token.payload = message.currentToken;
      await this.interrupt(token, true);
    };

    return this.eventAggregator.subscribeOnce(terminateEvent, onTerminatedCallback);
  }

  /**
   * Creates handlers for all BoundaryEvents attached this handler's FlowNode.
   *
   * @async
   * @param currentProcessToken The current Processtoken.
   * @param processTokenFacade  The Facade for managing the ProcessInstance's
   *                            ProcessTokens.
   * @param processModelFacade  The ProcessModelFacade containing the ProcessModel.
   * @param identity            The ProcessInstance owner.
   */
  private async _attachBoundaryEvents(
    currentProcessToken: Runtime.Types.ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<void> {

    const boundaryEventModels: Array<Model.Events.BoundaryEvent> = processModelFacade.getBoundaryEventsFor(this.flowNode);

    const noBoundaryEventsFound: boolean = !boundaryEventModels || boundaryEventModels.length === 0;
    if (noBoundaryEventsFound) {
      return;
    }

    // Createa a handler for each attached BoundaryEvent and store it in the internal collection.
    for (const model of boundaryEventModels) {
      await this._createBoundaryEventHandler(model, currentProcessToken, processTokenFacade, processModelFacade, identity);
    }
  }

  /**
   * Cancels and clears all BoundaryEvents attached to this handler.
   */
  private async _detachBoundaryEvents(): Promise<void> {
    for (const boundaryEventHandler of this._attachedBoundaryEventHandlers) {
      await boundaryEventHandler.cancel();
    }
    this._attachedBoundaryEventHandlers = [];
  }

  /**
   * Finds and returns all ErrorBoundaryEvents that are configured to
   * handle the given error.
   *
   * @returns The retrieved ErrorBoundaryEventHandlers.
   */
  private _findErrorBoundaryEventHandlersForError(error: Error): Array<ErrorBoundaryEventHandler> {
    const errorBoundaryEventHandlers: Array<ErrorBoundaryEventHandler> = this
      ._attachedBoundaryEventHandlers
      .filter((handler: IBoundaryEventHandler) => handler instanceof ErrorBoundaryEventHandler) as Array<ErrorBoundaryEventHandler>;

    const handlersForError: Array<ErrorBoundaryEventHandler> =
      errorBoundaryEventHandlers.filter((handler: ErrorBoundaryEventHandler) => handler.canHandleError(error));

    return handlersForError;
  }

  /**
   * Creates a handler for the given BoundaryEventModel and places it in this
   * handlers internal storage.
   *
   * @async
   * @param boundaryEventModel  The BoundaryEvent for which to create a handler.
   * @param currentProcessToken The current Processtoken.
   * @param processTokenFacade  The Facade for managing the ProcessInstance's
   *                            ProcessTokens.
   * @param processModelFacade  The ProcessModelFacade containing the ProcessModel.
   * @param identity            The ProcessInstance owner.
   */
  private async _createBoundaryEventHandler(
    boundaryEventModel: Model.Events.BoundaryEvent,
    currentProcessToken: Runtime.Types.ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<void> {
    const boundaryEventHandler: IBoundaryEventHandler =
      await this._boundaryEventHandlerFactory.create(boundaryEventModel, processModelFacade);

    const onBoundaryEventTriggeredCallback: OnBoundaryEventTriggeredCallback = async(eventData: OnBoundaryEventTriggeredData): Promise<void> => {
      return this._handleBoundaryEvent(eventData, currentProcessToken, processTokenFacade, processModelFacade, identity);
    };

    const isNonErrorBoundaryEvent: boolean = !boundaryEventModel.errorEventDefinition;
    if (isNonErrorBoundaryEvent) {
      await boundaryEventHandler.waitForTriggeringEvent(onBoundaryEventTriggeredCallback, currentProcessToken, processTokenFacade);
    }

    this._attachedBoundaryEventHandlers.push(boundaryEventHandler);
  }

  /**
   * Callback function for handling triggered BoundaryEvents.
   *
   * This will start a new execution flow that travels down the path attached
   * to the BoundaryEvent.
   *
   * If the triggered BoundaryEvent is interrupting, this will also cancel this
   * handler as well as all attached BoundaryEvents.
   *
   * @async
   * @param eventData           The data sent with the triggered BoundaryEvent.
   * @param currentProcessToken The current Processtoken.
   * @param processTokenFacade  The Facade for managing the ProcessInstance's
   *                            ProcessTokens.
   * @param processModelFacade  The ProcessModelFacade containing the ProcessModel.
   * @param identity            The ProcessInstance owner.
   */
  private async _handleBoundaryEvent(
    eventData: OnBoundaryEventTriggeredData,
    currentProcessToken: Runtime.Types.ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<void> {

    if (eventData.eventPayload) {
      currentProcessToken.payload = eventData.eventPayload;
    }

    if (eventData.interruptHandler) {
      await this.interrupt(currentProcessToken);
      await this._detachBoundaryEvents();
    }

    await this._continueAfterBoundaryEvent<typeof eventData.nextFlowNode>(
      eventData.nextFlowNode,
      currentProcessToken,
      processTokenFacade,
      processModelFacade,
      identity,
    );
   }

   /**
    * Starts a new execution flow that begins at the given BoundaryEvent.
    *
    * @async
    * @param nextFlowNode        The first FlowNode to run in this flow.
    * @param currentProcessToken The current Processtoken.
    * @param processTokenFacade  The Facade for managing the ProcessInstance's
    *                            ProcessTokens.
    * @param processModelFacade  The ProcessModelFacade containing the ProcessModel.
    * @param identity            The ProcessInstance owner.
    */
   private async _continueAfterBoundaryEvent<TNextFlowNode extends Model.Base.FlowNode>(
    nextFlowNode: TNextFlowNode,
    currentProcessToken: Runtime.Types.ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<void> {

    const handlerForNextFlowNode: IFlowNodeHandler<TNextFlowNode> =
      await this.flowNodeHandlerFactory.create<TNextFlowNode>(nextFlowNode, currentProcessToken);

    return handlerForNextFlowNode.execute(currentProcessToken, processTokenFacade, processModelFacade, identity, this.flowNodeInstanceId);
   }
}
