import {InternalServerError} from '@essential-projects/errors_ts';
import {EventReceivedCallback, Subscription} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';
import {
  eventAggregatorSettings,
  IBoundaryEventHandler,
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

interface FlowNodeModelInstanceAssociation {
  boundaryEventModel: Model.Events.BoundaryEvent;
  nextFlowNode: Model.Base.FlowNode;
  nextFlowNodeInstance: Runtime.Types.FlowNodeInstance;
}

export abstract class FlowNodeHandlerInterruptible<TFlowNode extends Model.Base.FlowNode>
  extends FlowNodeHandler<TFlowNode>
  implements IInterruptible {

  private _attachedBoundaryEventHandlers: Array<IBoundaryEventHandler> = [];

  private _terminationSubscription: Subscription;
  // tslint:disable-next-line:no-empty
  private _onInterruptedCallback: onInterruptionCallback = (): void => {};

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

  protected async afterExecute(
    token: Runtime.Types.ProcessToken,
    processTokenFacade?: IProcessTokenFacade,
    processModelFacade?: IProcessModelFacade,
    ): Promise<void> {
    this.eventAggregator.unsubscribe(this._terminationSubscription);
    await this._detachBoundaryEvents(token, processModelFacade);
  }

  public async execute(
    token: Runtime.Types.ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
    previousFlowNodeInstanceId?: string,
  ): Promise<void> {

    return new Promise<void>(async(resolve: Function, reject: Function): Promise<void> => {
      try {
        this._terminationSubscription = this._subscribeToProcessTermination(token, reject);
        await this._attachBoundaryEvents(token, processTokenFacade, processModelFacade, identity, resolve);

        await super.execute(token, processTokenFacade, processModelFacade, identity, previousFlowNodeInstanceId);

        return resolve();
      } catch (error) {
        const errorBoundaryEvents: Array<ErrorBoundaryEventHandler> = this._findErrorBoundaryEventHandlersForError(error);

        const noErrorBoundaryEventsAvailable: boolean = !errorBoundaryEvents || errorBoundaryEvents.length === 0;
        if (noErrorBoundaryEventsAvailable) {
          return reject(error);
        }

        token.payload = error;

        await this.afterExecute(token);

        await Promise.map(errorBoundaryEvents, async(boundaryEventHandler: ErrorBoundaryEventHandler) => {
          const flowNodeAfterBoundaryEvent: Model.Base.FlowNode = boundaryEventHandler.getNextFlowNode(processModelFacade);
          await this._continueAfterBoundaryEvent(flowNodeAfterBoundaryEvent, token, processTokenFacade, processModelFacade, identity);
        });

        return resolve();
      }
    });
  }

  public async resume(
    flowNodeInstances: Array<Runtime.Types.FlowNodeInstance>,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<void> {

    return new Promise<void>(async(resolve: Function, reject: Function): Promise<void> => {
      try {
        const flowNodeInstance: Runtime.Types.FlowNodeInstance =
          flowNodeInstances.find((instance: Runtime.Types.FlowNodeInstance) => instance.flowNodeId === this.flowNode.id);

        const flowNodeInstancesAfterBoundaryEvents: Array<FlowNodeModelInstanceAssociation> =
          this._getFlowNodeInstancesAfterBoundaryEvents(flowNodeInstances, processModelFacade);

          // No BoundaryEvent was triggered during the last execution. We can just resume the handler ordinarily.
        if (flowNodeInstancesAfterBoundaryEvents.length === 0) {
          await this._resumeOrdinarily(flowNodeInstance, flowNodeInstances, processTokenFacade, processModelFacade, identity, resolve, reject);
        } else {
          await this
            ._resumeWithBoundaryEvents(flowNodeInstancesAfterBoundaryEvents, flowNodeInstances, processTokenFacade, processModelFacade, identity);
        }
      } catch (error) {
        const errorBoundaryEvents: Array<ErrorBoundaryEventHandler> = this._findErrorBoundaryEventHandlersForError(error);

        const noErrorBoundaryEventsAvailable: boolean = !errorBoundaryEvents || errorBoundaryEvents.length === 0;
        if (noErrorBoundaryEventsAvailable) {
          return reject(error);
        }

        const token: Runtime.Types.ProcessToken = processTokenFacade.createProcessToken();
        token.payload = error;
        token.flowNodeInstanceId = this.flowNodeInstanceId;

        await Promise.map(errorBoundaryEvents, async(boundaryEventHandler: ErrorBoundaryEventHandler) => {
          const flowNodeAfterBoundaryEvent: Model.Base.FlowNode = boundaryEventHandler.getNextFlowNode(processModelFacade);
          await this._continueAfterBoundaryEvent(flowNodeAfterBoundaryEvent, token, processTokenFacade, processModelFacade, identity);
        });

        return resolve();
      }
    });
  }

  public async interrupt(token: Runtime.Types.ProcessToken, terminate?: boolean): Promise<void> {
    await this.onInterruptedCallback(token);
    await this.afterExecute(token);

    if (terminate) {
      return this.persistOnTerminate(token);
    }

    return this.persistOnExit(token);
  }

  private _subscribeToProcessTermination(token: Runtime.Types.ProcessToken, rejectionFunction: Function): Subscription {

    const terminateEvent: string = eventAggregatorSettings.messagePaths.terminateEndEventReached
      .replace(eventAggregatorSettings.messageParams.processInstanceId, token.processInstanceId);

    const onTerminatedCallback: EventReceivedCallback = async(message: TerminateEndEventReachedMessage): Promise<void> => {

      const processTerminatedError: string = `Process was terminated through TerminateEndEvent '${message.flowNodeId}'!`;
      this.logger.error(processTerminatedError);

      token.payload = message.currentToken;
      await this.interrupt(token, true);

      const terminationError: InternalServerError = new InternalServerError(processTerminatedError);

      return rejectionFunction(terminationError);
    };

    return this.eventAggregator.subscribeOnce(terminateEvent, onTerminatedCallback);
  }

  private async _resumeOrdinarily(
    flowNodeInstance: Runtime.Types.FlowNodeInstance,
    flowNodeInstances: Array<Runtime.Types.FlowNodeInstance>,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
    resolve: Function,
    reject: Function,
  ): Promise<void> {

    const tokenForHandlerHooks: Runtime.Types.ProcessToken = flowNodeInstance.tokens[0];

    this._terminationSubscription = this._subscribeToProcessTermination(tokenForHandlerHooks, reject);
    await this._attachBoundaryEvents(tokenForHandlerHooks, processTokenFacade, processModelFacade, identity, resolve);

    await super.resume(flowNodeInstances, processTokenFacade, processModelFacade, identity);

    return resolve();
  }

  private async _resumeWithBoundaryEvents(
    flowNodeInstancesAfterBoundaryEvents: Array<FlowNodeModelInstanceAssociation>,
    flowNodeInstances: Array<Runtime.Types.FlowNodeInstance>,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<void> {
    // Resume all Paths that follow the BoundaryEvents
    const handlersToResume: Array<IFlowNodeHandler<Model.Base.FlowNode>> =
      await Promise.map(flowNodeInstancesAfterBoundaryEvents, async(entry: FlowNodeModelInstanceAssociation) => {
        return this.flowNodeHandlerFactory.create(entry.nextFlowNode);
      });

    const handlerResumptionPromises: Array<Promise<void>> = handlersToResume.map((handler: IFlowNodeHandler<Model.Base.FlowNode>) => {
      return handler.resume(flowNodeInstances, processTokenFacade, processModelFacade, identity);
    });

    // Check if one of the BoundaryEvents was interrupting. If so, the handler must not be resumed.
    const noInterruptingBoundaryEventsTriggered: boolean =
      !flowNodeInstancesAfterBoundaryEvents.some((entry: FlowNodeModelInstanceAssociation) => entry.boundaryEventModel.cancelActivity === true);
    if (noInterruptingBoundaryEventsTriggered) {
      handlerResumptionPromises.push(super.resume(flowNodeInstances, processTokenFacade, processModelFacade, identity));
    }

    await Promise.all(handlerResumptionPromises);
  }

  /**
   * Required for resuming BoundaryEvent paths.
   * Checks if any of the given FlowNodeInstances are from a FlowNode that
   * followed one of the BoundaryEvents attached to this handler.
   *
   * This must be done for all resumptions, to account for non-interrupting BoundaryEvents.
   *
   * @param flowNodeInstances The list of FlowNodeInstances to check.
   */
  private _getFlowNodeInstancesAfterBoundaryEvents(
    flowNodeInstances: Array<Runtime.Types.FlowNodeInstance>,
    processModelFacade: IProcessModelFacade,
  ): Array<FlowNodeModelInstanceAssociation> {

    const boundaryEvents: Array<Model.Events.BoundaryEvent> = processModelFacade.getBoundaryEventsFor(this.flowNode);
    if (boundaryEvents.length === 0) {
      return [];
    }

    // First get all FlowNodeInstances for the BoundaryEvents attached to this handler.
    const boundaryEventInstances: Array<Runtime.Types.FlowNodeInstance> =
      flowNodeInstances.filter((fni: Runtime.Types.FlowNodeInstance) => {
        return boundaryEvents.some((boundaryEvent: Model.Events.BoundaryEvent) => {
          return boundaryEvent.id === fni.flowNodeId;
        });
      });

    // Then get all FlowNodeInstances that followed one of the BoundaryEventInstances.
    const flowNodeInstancesAfterBoundaryEvents: Array<Runtime.Types.FlowNodeInstance> =
      flowNodeInstances.filter((fni: Runtime.Types.FlowNodeInstance) => {
        return boundaryEventInstances.some((boundaryInstance: Runtime.Types.FlowNodeInstance) => {
          return fni.previousFlowNodeInstanceId === boundaryInstance.id;
        });
      });

    const flowNodeModelInstanceAssociations: Array<FlowNodeModelInstanceAssociation> =
      flowNodeInstancesAfterBoundaryEvents.map((fni: Runtime.Types.FlowNodeInstance) => {
        return <FlowNodeModelInstanceAssociation> {
          boundaryEventModel: getBoundaryEventPreceedingFlowNodeInstance(fni),
          nextFlowNodeInstance: fni,
          nextFlowNode: processModelFacade.getFlowNodeById(fni.flowNodeId),
        };
      });

    const getBoundaryEventPreceedingFlowNodeInstance: Function = (flowNodeInstance: Runtime.Types.FlowNodeInstance): Model.Events.BoundaryEvent => {
      const matchingBoundaryEventInstance: Runtime.Types.FlowNodeInstance =
        flowNodeInstances.find((entry: Runtime.Types.FlowNodeInstance) => entry.flowNodeId === flowNodeInstance.previousFlowNodeInstanceId);

      return boundaryEvents.find((entry: Model.Events.BoundaryEvent) => entry.id === matchingBoundaryEventInstance.flowNodeId);
    };

    return flowNodeModelInstanceAssociations;
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
   * @param handlerResolve      The function that will cleanup the main handler
   *                            Promise, if an interrupting BoundaryEvent was
   *                            triggered.
   */
  private async _attachBoundaryEvents(
    currentProcessToken: Runtime.Types.ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
    handlerResolve: Function,
  ): Promise<void> {

    const boundaryEventModels: Array<Model.Events.BoundaryEvent> = processModelFacade.getBoundaryEventsFor(this.flowNode);

    const noBoundaryEventsFound: boolean = !boundaryEventModels || boundaryEventModels.length === 0;
    if (noBoundaryEventsFound) {
      return;
    }

    // Createa a handler for each attached BoundaryEvent and store it in the internal collection.
    for (const model of boundaryEventModels) {
      await this._createBoundaryEventHandler(model, currentProcessToken, processTokenFacade, processModelFacade, identity, handlerResolve);
    }
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
   * @param handlerResolve      The function that will cleanup the main handler
   *                            Promise, if an interrupting BoundaryEvent was
   *                            triggered.
   */
  private async _createBoundaryEventHandler(
    boundaryEventModel: Model.Events.BoundaryEvent,
    currentProcessToken: Runtime.Types.ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
    handlerResolve: Function,
  ): Promise<void> {
    const boundaryEventHandler: IBoundaryEventHandler = await this.flowNodeHandlerFactory.createForBoundaryEvent(boundaryEventModel);

    const onBoundaryEventTriggeredCallback: OnBoundaryEventTriggeredCallback = async(eventData: OnBoundaryEventTriggeredData): Promise<void> => {
      // To prevent the Promise-chain from being broken too soon, we must first await the execution of the BoundaryEvent's execution path.
      // Interruption will already have happended, when this path is finished, so there is no danger of running this handler twice.
      await this._handleBoundaryEvent(eventData, currentProcessToken, processTokenFacade, processModelFacade, identity);

      if (eventData.interruptHandler) {
        return handlerResolve(undefined);
      }
    };

    await boundaryEventHandler
      .waitForTriggeringEvent(onBoundaryEventTriggeredCallback, currentProcessToken, processTokenFacade, processModelFacade, this.flowNodeInstanceId);

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

   /**
    * Cancels and clears all BoundaryEvents attached to this handler.
    */
   private async _detachBoundaryEvents(token: Runtime.Types.ProcessToken, processModelFacade: IProcessModelFacade): Promise<void> {
     for (const boundaryEventHandler of this._attachedBoundaryEventHandlers) {
       await boundaryEventHandler.cancel(token, processModelFacade);
     }
     this._attachedBoundaryEventHandlers = [];
   }
}
