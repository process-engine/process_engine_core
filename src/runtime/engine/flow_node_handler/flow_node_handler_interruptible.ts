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
    await Promise.map(boundaryEventModels, async(model: Model.Events.BoundaryEvent): Promise<void> => {
      await this._createBoundaryEventHandler(model, currentProcessToken, processTokenFacade, processModelFacade, identity);
    });
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
      this.interrupt(currentProcessToken);
      await this._detachBoundaryEvents();
    }

    const handlerForNextFlowNode: IFlowNodeHandler<typeof eventData.nextFlowNode> =
      await this.flowNodeHandlerFactory.create<typeof eventData.nextFlowNode>(eventData.nextFlowNode, currentProcessToken);

    handlerForNextFlowNode.execute(currentProcessToken, processTokenFacade, processModelFacade, identity, this.flowNodeInstanceId);
   }
}
