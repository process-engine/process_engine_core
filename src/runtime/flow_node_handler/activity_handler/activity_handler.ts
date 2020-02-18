import {InternalServerError} from '@essential-projects/errors_ts';
import {Subscription} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';

import {
  FlowNodeInstance,
  FlowNodeInstanceState,
  Model,
  ProcessToken,
  ProcessTokenType,
} from '@process-engine/persistence_api.contracts';
import {
  ActivityFinishedMessage,
  ActivityReachedMessage,
  BpmnError,
  IBoundaryEventHandler,
  IFlowNodeHandler,
  IFlowNodeInstanceResult,
  IProcessModelFacade,
  IProcessTokenFacade,
  OnBoundaryEventTriggeredData,
  eventAggregatorSettings,
} from '@process-engine/process_engine_contracts';

import {ErrorBoundaryEventHandler} from '../boundary_event_handler/index';

import {FlowNodeHandler} from '../flow_node_handler';

interface IFlowNodeModelInstanceAssociation {
  boundaryEventModel: Model.Events.BoundaryEvent;
  nextFlowNode: Model.Base.FlowNode;
  nextFlowNodeInstance: FlowNodeInstance;
}

/**
 * This is the base handler for all Activities and Tasks.
 */
export abstract class ActivityHandler<TFlowNode extends Model.Base.FlowNode> extends FlowNodeHandler<TFlowNode> {

  private attachedBoundaryEventHandlers: Array<IBoundaryEventHandler> = [];

  public async execute(
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
    previousFlowNodeInstanceId?: string,
  ): Promise<void> {

    return new Promise<void>(async (resolve: Function, reject: Function): Promise<void> => {
      this.previousFlowNodeInstanceId = previousFlowNodeInstanceId;
      token.flowNodeInstanceId = this.flowNodeInstanceId;

      const laneContainingCurrentFlowNode = processModelFacade.getLaneForFlowNode(this.flowNode.id);
      if (laneContainingCurrentFlowNode != undefined) {
        token.currentLane = laneContainingCurrentFlowNode.name;
      }

      try {
        this.terminationSubscription = this.subscribeToProcessTermination(token, reject);
        this.processErrorSubscription = this.subscribeToProcessError(token, reject);
        await this.attachBoundaryEvents(token, processTokenFacade, processModelFacade, identity, resolve);

        await this.beforeExecute(token, processTokenFacade, processModelFacade, identity);
        const nextFlowNodes = await this.startExecution(token, processTokenFacade, processModelFacade, identity);
        await this.afterExecute(token, processTokenFacade, processModelFacade, identity);

        // EndEvents will return "undefined" as the next FlowNode.
        // So if no FlowNode is to be run next, we have arrived at the end of the current flow.
        const processIsNotYetFinished = nextFlowNodes?.length > 0;
        if (processIsNotYetFinished) {

          const nextFlowNodeExecutionPromises: Array<Promise<void>> = [];

          for (const nextFlowNode of nextFlowNodes) {

            // If we must execute multiple branches, then each branch must get its own ProcessToken and Facade.
            const processTokenForBranch = nextFlowNodes.length > 1
              ? processTokenFacade.createProcessToken(token.payload)
              : token;

            const processTokenFacadeForFlowNode = nextFlowNodes.length > 1
              ? processTokenFacade.getProcessTokenFacadeForParallelBranch()
              : processTokenFacade;

            const handleNextFlowNodePromise = this.handleNextFlowNode(
              nextFlowNode,
              processTokenFacadeForFlowNode,
              processModelFacade,
              processTokenForBranch,
              identity,
            );
            nextFlowNodeExecutionPromises.push(handleNextFlowNodePromise);
          }

          await Promise.all(nextFlowNodeExecutionPromises);
        }

        return resolve();
      } catch (error) {
        return this.handleActivityError(token, error, processTokenFacade, processModelFacade, identity, resolve, reject);
      }
    });
  }

  public async resume(
    flowNodeInstanceForHandler: FlowNodeInstance,
    allFlowNodeInstances: Array<FlowNodeInstance>,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<void> {

    return new Promise<void>(async (resolve: Function, reject: Function): Promise<void> => {
      this.previousFlowNodeInstanceId = flowNodeInstanceForHandler.previousFlowNodeInstanceId;
      this.flowNodeInstanceId = flowNodeInstanceForHandler.id;

      let nextFlowNodes: Array<Model.Base.FlowNode>;

      // It doesn't really matter which token is used here, since payload-specific operations should
      // only ever be done during the handler's execution.
      // We only require the token here, so that we can pass infos like ProcessInstanceId or CorrelationId to the hook.
      const token = flowNodeInstanceForHandler.tokens[0];

      try {
        const flowNodeInstancesAfterBoundaryEvents = this.getFlowNodeInstancesAfterBoundaryEvents(allFlowNodeInstances, processModelFacade);

        await this.beforeExecute(token, processTokenFacade, processModelFacade, identity);

        if (flowNodeInstancesAfterBoundaryEvents.length === 0) {
          this.terminationSubscription = this.subscribeToProcessTermination(token, reject);
          this.processErrorSubscription = this.subscribeToProcessError(token, reject);
          await this.attachBoundaryEvents(token, processTokenFacade, processModelFacade, identity, resolve, allFlowNodeInstances);

          nextFlowNodes = await this.resumeFromState(flowNodeInstanceForHandler, processTokenFacade, processModelFacade, identity);
        } else {
          await this.resumeWithBoundaryEvents(
            flowNodeInstanceForHandler,
            flowNodeInstancesAfterBoundaryEvents,
            allFlowNodeInstances,
            processTokenFacade,
            processModelFacade,
            identity,
          );
        }

        await this.afterExecute(token, processTokenFacade, processModelFacade, identity);

        // EndEvents will return "undefined" as the next FlowNode.
        // So if no FlowNode is returned, we have arrived at the end of the ProcessInstance.
        const processIsNotYetFinished = nextFlowNodes?.length > 0;
        if (processIsNotYetFinished) {

          const currentResult = processTokenFacade
            .getAllResults()
            .pop();

          const nextFlowNodeExecutionPromises: Array<Promise<void>> = [];

          for (const nextFlowNode of nextFlowNodes) {

            const processTokenForBranch = nextFlowNodes.length > 1
              ? processTokenFacade.createProcessToken(currentResult)
              : token;

            const processTokenFacadeForFlowNode = nextFlowNodes.length > 1
              ? processTokenFacade.getProcessTokenFacadeForParallelBranch()
              : processTokenFacade;

            const nextFlowNodeInstance = this.findNextInstanceOfFlowNode(allFlowNodeInstances, nextFlowNode.id);

            const handleNextFlowNodePromise = this.handleNextFlowNode(
              nextFlowNode,
              processTokenFacadeForFlowNode,
              processModelFacade,
              processTokenForBranch,
              identity,
              nextFlowNodeInstance,
              allFlowNodeInstances,
            );
            nextFlowNodeExecutionPromises.push(handleNextFlowNodePromise);
          }

          await Promise.all(nextFlowNodeExecutionPromises);
        }

        return resolve();
      } catch (error) {
        return this.handleActivityError(token, error, processTokenFacade, processModelFacade, identity, resolve, reject);
      }
    });
  }

  protected async resumeFromState(
    flowNodeInstance: FlowNodeInstance,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
    processFlowNodeInstances?: Array<FlowNodeInstance>,
  ): Promise<Array<Model.Base.FlowNode>> {

    this.logger.verbose(`Resuming FlowNodeInstance ${flowNodeInstance.id}.`);

    switch (flowNodeInstance.state) {
      case FlowNodeInstanceState.suspended:
        this.logger.verbose('FlowNodeInstance was left suspended. Waiting for the resuming event to happen.');
        const suspendToken = flowNodeInstance.getTokenByType(ProcessTokenType.onSuspend);

        return this.continueAfterSuspend(flowNodeInstance, suspendToken, processTokenFacade, processModelFacade, identity);

      case FlowNodeInstanceState.running:
        const resumeToken = flowNodeInstance.getTokenByType(ProcessTokenType.onResume);

        const notSuspendedYet = resumeToken == undefined;
        if (notSuspendedYet) {
          this.logger.verbose('FlowNodeInstance was interrupted at the beginning. Resuming from the start.');
          const onEnterToken = flowNodeInstance.getTokenByType(ProcessTokenType.onEnter);

          return this.continueAfterEnter(onEnterToken, processTokenFacade, processModelFacade, identity);
        }

        this.logger.verbose('The FlowNodeInstance was already suspended and resumed. Finishing up the handler.');

        return this.continueAfterResume(resumeToken, processTokenFacade, processModelFacade);

      case FlowNodeInstanceState.finished:
        this.logger.verbose('FlowNodeInstance was already finished. Skipping ahead.');
        const onExitToken = flowNodeInstance.getTokenByType(ProcessTokenType.onExit);

        return this.continueAfterExit(onExitToken, processTokenFacade, processModelFacade, identity);

      case FlowNodeInstanceState.error:
        this.logger.error(
          `Cannot resume FlowNodeInstance ${flowNodeInstance.id}, because it previously exited with an error!`,
          flowNodeInstance.error,
        );
        throw flowNodeInstance.error;

      case FlowNodeInstanceState.terminated:
        const terminatedError = `Cannot resume FlowNodeInstance ${flowNodeInstance.id}, because it was terminated!`;
        this.logger.error(terminatedError);
        throw new InternalServerError(terminatedError);

      default:
        const invalidStateError = `Cannot resume FlowNodeInstance ${flowNodeInstance.id}, because its state cannot be determined!`;
        this.logger.error(invalidStateError);
        throw new InternalServerError(invalidStateError);
    }
  }

  protected async afterExecute(
    token?: ProcessToken,
    processTokenFacade?: IProcessTokenFacade,
    processModelFacade?: IProcessModelFacade,
    identity?: IIdentity,
  ): Promise<void> {
    await this.detachBoundaryEvents(token, processModelFacade);
    await super.afterExecute(token, processTokenFacade, processModelFacade, identity);
  }

  protected async continueAfterSuspend(
    flowNodeInstance: FlowNodeInstance,
    onSuspendToken: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity?: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {
    processTokenFacade.addResultForFlowNode(this.flowNode.id, this.flowNodeInstanceId, onSuspendToken.payload);
    await this.persistOnResume(onSuspendToken);
    await this.persistOnExit(onSuspendToken);

    return processModelFacade.getNextFlowNodesFor(this.flowNode);
  }

  protected async continueAfterResume(
    resumeToken: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity?: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {
    processTokenFacade.addResultForFlowNode(this.flowNode.id, this.flowNodeInstanceId, resumeToken.payload);
    await this.persistOnExit(resumeToken);

    return processModelFacade.getNextFlowNodesFor(this.flowNode);
  }

  private async handleActivityError(
    token: ProcessToken,
    error: Error,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
    resolveFunc: Function,
    rejectFunc: Function,
  ): Promise<void> {

    token.payload = error;

    const allResults = processTokenFacade.getAllResults();
    // This check is necessary to prevent duplicate entries,
    // in case the Promise-Chain was broken further down the road.
    const noResultStoredYet = !allResults.some((entry: IFlowNodeInstanceResult): boolean => entry.flowNodeInstanceId === this.flowNodeInstanceId);
    if (noResultStoredYet) {
      processTokenFacade.addResultForFlowNode(this.flowNode.id, this.flowNodeInstanceId, error);
    }

    const errorBoundaryEvents = this.findErrorBoundaryEventHandlersForError(error, token);

    await this.afterExecute(token);

    const terminationRegex = /terminated/i;
    const isTerminationMessage = terminationRegex.test(error.message);

    const noErrorBoundaryEventsAvailable = !errorBoundaryEvents || errorBoundaryEvents.length === 0;
    if (noErrorBoundaryEventsAvailable || isTerminationMessage) {
      return rejectFunc(error);
    }

    try {
      await Promise.map(errorBoundaryEvents, async (errorHandler: ErrorBoundaryEventHandler): Promise<void> => {
        const flowNodeAfterBoundaryEvent = errorHandler.getNextFlowNode(processModelFacade);
        const errorHandlerId = errorHandler.getInstanceId();
        await this.continueAfterBoundaryEvent(errorHandlerId, flowNodeAfterBoundaryEvent, token, processTokenFacade, processModelFacade, identity);
      });
    } catch (errorFromBoundaryEventChain) {
      rejectFunc(errorFromBoundaryEventChain);
    }

    return resolveFunc();
  }

  private async resumeWithBoundaryEvents(
    currentFlowNodeInstance: FlowNodeInstance,
    flowNodeInstancesAfterBoundaryEvents: Array<IFlowNodeModelInstanceAssociation>,
    flowNodeInstances: Array<FlowNodeInstance>,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<void> {
    // Resume all Paths that follow the BoundaryEvents
    const handlersToResume = await Promise.map(
      flowNodeInstancesAfterBoundaryEvents,
      async (entry: IFlowNodeModelInstanceAssociation): Promise<IFlowNodeHandler<Model.Base.FlowNode>> => {
        return this.flowNodeHandlerFactory.create(entry.nextFlowNode);
      },
    );

    const handlerResumptionPromises = handlersToResume.map((handler: IFlowNodeHandler<Model.Base.FlowNode>): Promise<any> => {
      const matchingEntry = flowNodeInstancesAfterBoundaryEvents.find((entry: IFlowNodeModelInstanceAssociation): boolean => {
        return entry.nextFlowNodeInstance.id === handler.getInstanceId();
      });

      return handler.resume(matchingEntry.nextFlowNodeInstance, flowNodeInstances, processTokenFacade, processModelFacade, identity);
    });

    // Check if one of the BoundaryEvents was interrupting. If so, the handler must not be resumed.
    const noInterruptingBoundaryEventsTriggered = !flowNodeInstancesAfterBoundaryEvents
      .some((entry: IFlowNodeModelInstanceAssociation): boolean => entry.boundaryEventModel.cancelActivity === true);

    if (noInterruptingBoundaryEventsTriggered) {
      handlerResumptionPromises.push(this.resumeFromState(currentFlowNodeInstance, processTokenFacade, processModelFacade, identity));
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
  private getFlowNodeInstancesAfterBoundaryEvents(
    flowNodeInstances: Array<FlowNodeInstance>,
    processModelFacade: IProcessModelFacade,
  ): Array<IFlowNodeModelInstanceAssociation> {

    const getBoundaryEventPrecedingFlowNodeInstance = (flowNodeInstance: FlowNodeInstance): Model.Events.BoundaryEvent => {
      const matchingBoundaryEventInstance =
        flowNodeInstances.find((entry: FlowNodeInstance): boolean => entry.flowNodeId === flowNodeInstance.previousFlowNodeInstanceId);

      return boundaryEvents.find((entry: Model.Events.BoundaryEvent): boolean => entry.id === matchingBoundaryEventInstance.flowNodeId);
    };

    const boundaryEvents = processModelFacade.getBoundaryEventsFor(this.flowNode);
    if (boundaryEvents.length === 0) {
      return [];
    }

    // First get all FlowNodeInstances for the BoundaryEvents attached to this handler.
    const boundaryEventInstances = flowNodeInstances.filter((fni: FlowNodeInstance): boolean => {
      return boundaryEvents.some((boundaryEvent: Model.Events.BoundaryEvent): boolean => {
        return boundaryEvent.id === fni.flowNodeId;
      });
    });

    // Then get all FlowNodeInstances that followed one of the BoundaryEventInstances.
    const flowNodeInstancesAfterBoundaryEvents = flowNodeInstances.filter((fni: FlowNodeInstance): boolean => {
      return boundaryEventInstances.some((boundaryInstance: FlowNodeInstance): boolean => {
        return fni.previousFlowNodeInstanceId === boundaryInstance.id;
      });
    });

    const flowNodeModelInstanceAssociations = flowNodeInstancesAfterBoundaryEvents.map((fni: FlowNodeInstance): IFlowNodeModelInstanceAssociation => {
      return {
        boundaryEventModel: getBoundaryEventPrecedingFlowNodeInstance(fni),
        nextFlowNodeInstance: fni,
        nextFlowNode: processModelFacade.getFlowNodeById(fni.flowNodeId),
      };
    });

    return flowNodeModelInstanceAssociations;
  }

  // TODO: Move to BoundaryEventService.

  /**
   * Creates handlers for all BoundaryEvents attached this handler's FlowNode.
   *
   * @async
   * @param processToken        The current Processtoken.
   * @param processTokenFacade  The Facade for managing the ProcessInstance's
   *                            ProcessTokens.
   * @param processModelFacade  The ProcessModelFacade containing the ProcessModel.
   * @param identity            The ProcessInstance owner.
   * @param handlerResolve      The function that will cleanup the main handler
   *                            Promise, if an interrupting BoundaryEvent was
   *                            triggered.
   */
  private async attachBoundaryEvents(
    processToken: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
    handlerResolve: Function,
    flowNodeInstances?: Array<FlowNodeInstance>,
  ): Promise<void> {

    const boundaryEventModels = processModelFacade.getBoundaryEventsFor(this.flowNode);

    const noBoundaryEventsFound = boundaryEventModels?.length === 0;
    if (noBoundaryEventsFound) {
      return;
    }

    // Create a handler for each attached BoundaryEvent and store it in the internal collection.
    for (const model of boundaryEventModels) {
      const flowNodeInstance = flowNodeInstances?.find((entry) => {
        return entry.flowNodeId === model.id && entry.previousFlowNodeInstanceId === this.flowNodeInstanceId;
      });

      await this.createBoundaryEventHandler(model, processToken, processTokenFacade, processModelFacade, identity, handlerResolve, flowNodeInstance);
    }
  }

  private async detachBoundaryEvents(token: ProcessToken, processModelFacade: IProcessModelFacade): Promise<void> {
    for (const boundaryEventHandler of this.attachedBoundaryEventHandlers) {
      await boundaryEventHandler.cancel(token, processModelFacade);
    }

    this.attachedBoundaryEventHandlers = [];
  }

  private findErrorBoundaryEventHandlersForError(error: Error, token: ProcessToken): Array<ErrorBoundaryEventHandler> {
    const errorBoundaryEventHandlers = this
      .attachedBoundaryEventHandlers
      .filter((handler): boolean => handler instanceof ErrorBoundaryEventHandler) as Array<ErrorBoundaryEventHandler>;

    const handlersForError =
      errorBoundaryEventHandlers.filter((handler: ErrorBoundaryEventHandler): boolean => handler.canHandleError(error as BpmnError, token));

    return handlersForError;
  }

  private async createBoundaryEventHandler(
    boundaryEventModel: Model.Events.BoundaryEvent,
    processToken: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
    handlerResolve: Function,
    flowNodeInstance?: FlowNodeInstance,
  ): Promise<void> {
    const boundaryEventHandler = await this.flowNodeHandlerFactory.createForBoundaryEvent(boundaryEventModel);

    // eslint-disable-next-line consistent-return
    const onBoundaryEventTriggeredCallback = async (eventData: OnBoundaryEventTriggeredData): Promise<void> => {
      // To prevent the Promise-chain from being broken too soon, we must first await the execution of the BoundaryEvent's execution path.
      // Interruption will already have happended, when this path is finished, so there is no danger of running this handler twice.
      await this.handleBoundaryEvent(eventData, processToken, processTokenFacade, processModelFacade, identity);

      if (eventData.interruptHandler) {
        return handlerResolve(undefined);
      }
    };

    if (flowNodeInstance) {
      await boundaryEventHandler.resumeWait(
        flowNodeInstance,
        onBoundaryEventTriggeredCallback,
        processToken,
        processTokenFacade,
        processModelFacade,
        this.flowNodeInstanceId,
      );
    } else {
      await boundaryEventHandler
        .waitForTriggeringEvent(onBoundaryEventTriggeredCallback, processToken, processTokenFacade, processModelFacade, this.flowNodeInstanceId);
    }

    this.attachedBoundaryEventHandlers.push(boundaryEventHandler);
  }

  /**
   * Callback function for handling triggered BoundaryEvents.
   *
   * This will start a new execution flow that travels down the path attached
   * to the BoundaryEvent.
   * If the triggered BoundaryEvent is interrupting, this function will also cancel
   * this handler as well as all attached BoundaryEvents.
   *
   * @async
   * @param eventData          The data sent with the triggered BoundaryEvent.
   * @param verbose            The current Processtoken.
   * @param processTokenFacade The Facade for managing the ProcessInstance's ProcessTokens.
   * @param processModelFacade The ProcessModelFacade containing the ProcessModel.
   * @param identity           The ProcessInstance owner.
   */
  private async handleBoundaryEvent(
    eventData: OnBoundaryEventTriggeredData,
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<void> {

    if (eventData.eventPayload) {
      token.payload = eventData.eventPayload;
    }

    if (eventData.interruptHandler) {
      await this.onInterruptedCallback(token);
      await this.afterExecute(token);
      await this.persistOnExit(token);
    }

    await this.continueAfterBoundaryEvent<typeof eventData.nextFlowNode>(
      eventData.boundaryInstanceId,
      eventData.nextFlowNode,
      token,
      processTokenFacade,
      processModelFacade,
      identity,
    );
  }

  /**
   * Starts a new execution flow that begins at the given BoundaryEvent instance.
   *
   * @async
   * @param boundaryInstanceId  The instance Id of the triggered BoundaryEvent.
   * @param nextFlowNode        The first FlowNode to run in this flow.
   * @param currentProcessToken The current Processtoken.
   * @param processTokenFacade  The Facade for managing the ProcessInstance's
   *                            ProcessTokens.
   * @param processModelFacade  The ProcessModelFacade containing the ProcessModel.
   * @param identity            The ProcessInstance owner.
   */
  private async continueAfterBoundaryEvent<TNextFlowNode extends Model.Base.FlowNode>(
    boundaryInstanceId: string,
    nextFlowNode: TNextFlowNode,
    currentProcessToken: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<void> {

    const handlerForNextFlowNode: IFlowNodeHandler<TNextFlowNode> =
      await this.flowNodeHandlerFactory.create<TNextFlowNode>(nextFlowNode, currentProcessToken);

    return handlerForNextFlowNode.execute(currentProcessToken, processTokenFacade, processModelFacade, identity, boundaryInstanceId);
  }

  protected publishActivityReachedNotification(identity: IIdentity, token: ProcessToken): void {

    const message = new ActivityReachedMessage(
      token.correlationId,
      token.processModelId,
      token.processInstanceId,
      this.flowNode.id,
      this.flowNodeInstanceId,
      this.flowNode.bpmnType,
      identity,
      token.payload,
    );

    this.eventAggregator.publish(eventAggregatorSettings.messagePaths.activityReached, message);
  }

  protected publishActivityFinishedNotification(identity: IIdentity, token: ProcessToken): void {

    const message = new ActivityFinishedMessage(
      token.correlationId,
      token.processModelId,
      token.processInstanceId,
      this.flowNode.id,
      this.flowNodeInstanceId,
      this.flowNode.bpmnType,
      identity,
      token.payload,
    );

    // Global notification
    this.eventAggregator.publish(eventAggregatorSettings.messagePaths.activityFinished, message);
  }

}
