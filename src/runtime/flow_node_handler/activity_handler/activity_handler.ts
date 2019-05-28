import {InternalServerError} from '@essential-projects/errors_ts';
import {Subscription} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';

import {
  FlowNodeInstance,
  FlowNodeInstanceState,
  ProcessToken,
  ProcessTokenType,
} from '@process-engine/flow_node_instance.contracts';
import {
  IBoundaryEventHandler,
  IFlowNodeHandler,
  IInterruptible,
  IProcessModelFacade,
  IProcessTokenFacade,
  OnBoundaryEventTriggeredData,
  TerminateEndEventReachedMessage,
  eventAggregatorSettings,
} from '@process-engine/process_engine_contracts';
import {Model} from '@process-engine/process_model.contracts';

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
export abstract class ActivityHandler<TFlowNode extends Model.Base.FlowNode> extends FlowNodeHandler<TFlowNode> implements IInterruptible {

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

      try {
        this.terminationSubscription = this.subscribeToProcessTermination(token, reject);
        await this.attachBoundaryEvents(token, processTokenFacade, processModelFacade, identity, resolve);

        await this.beforeExecute(token, processTokenFacade, processModelFacade, identity);
        const nextFlowNodes = await this.startExecution(token, processTokenFacade, processModelFacade, identity);
        await this.afterExecute(token, processTokenFacade, processModelFacade, identity);

        // EndEvents will return "undefined" as the next FlowNode.
        // So if no FlowNode is to be run next, we have arrived at the end of the current flow.
        const processIsNotYetFinished = nextFlowNodes !== undefined && nextFlowNodes.length > 0;
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
          await this.attachBoundaryEvents(token, processTokenFacade, processModelFacade, identity, resolve);

          nextFlowNodes = await this.resumeFromState(flowNodeInstanceForHandler, processTokenFacade, processModelFacade, identity);
        } else {
          await this.resumeWithBoundaryEvents(
            flowNodeInstanceForHandler,
            allFlowNodeInstances,
            flowNodeInstancesAfterBoundaryEvents,
            processTokenFacade,
            processModelFacade,
            identity,
          );
        }

        await this.afterExecute(token, processTokenFacade, processModelFacade, identity);

        // EndEvents will return "undefined" as the next FlowNode.
        // So if no FlowNode is returned, we have arrived at the end of the ProcessInstance.
        const processIsNotYetFinished = nextFlowNodes && nextFlowNodes.length > 0;
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

            // NOTE:
            // This is a workaround for a problem with the resumption of multiple parallel branches that were executed right up to the JoinGateway.
            // When multiple branches arrive at the JoinGateway at the EXACT same moment, it is possible
            // that multiple instances for that same Gateway are created.
            // Since the Gateway always waits for ALL incoming branches before moving on,
            // this will result in the process instance getting stuck forever.
            // Using a timeout helps us to get around this issue, but it is just a hacky workaround. We need a more permanent solution for this.
            if (nextFlowNodes.length > 1) {
              await new Promise((cb): NodeJS.Timeout => setTimeout(cb, 100));
            }
          }

          await Promise.all(nextFlowNodeExecutionPromises);
        }

        return resolve();
      } catch (error) {
        return this.handleActivityError(token, error, processTokenFacade, processModelFacade, identity, resolve, reject);
      }
    });
  }

  public async interrupt(token: ProcessToken, terminate?: boolean, interruptorId?: string): Promise<void> {
    await this.onInterruptedCallback(token);
    await this.afterExecute(token);

    if (terminate) {
      return this.persistOnTerminate(token);
    }

    return this.persistOnInterrupt(token, interruptorId);
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

        const notSuspendedYet = resumeToken === undefined;
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
    await super.afterExecute(token, processTokenFacade, processModelFacade, identity);
    await this.detachBoundaryEvents(token, processModelFacade);
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

  /**
   * Resumes the given FlowNodeInstance from the point it was interrupted.
   * This is used to divert ProcessResumption through the BoundaryEvent
   * that previously interrupted the FlowNodeInstance.
   *
   * @async
   * @param   onInterruptToken   The final ProcessToken, after the
   *                             FlowNodeInstance was interrupted.
   * @param   processTokenFacade The ProcessTokenFacade to use for resuming.
   * @param   processModelFacade The processModelFacade to use for resuming.
   * @param   identity           The identity of the user that originally
   *                             started the ProcessInstance.
   * @returns                    The Info for the next FlowNode to run.
   */
  protected async continueAfterInterrupt(
    onInterruptToken: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity?: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    // WIP
    processTokenFacade.addResultForFlowNode(this.flowNode.id, this.flowNodeInstanceId, onInterruptToken.payload);

    return processModelFacade.getNextFlowNodesFor(this.flowNode);
  }

  protected async persistOnSuspend(processToken: ProcessToken): Promise<void> {
    await this.flowNodePersistenceFacade.persistOnSuspend(this.flowNode, this.flowNodeInstanceId, processToken);
  }

  protected async persistOnResume(processToken: ProcessToken): Promise<void> {
    await this.flowNodePersistenceFacade.persistOnResume(this.flowNode, this.flowNodeInstanceId, processToken);
  }

  protected subscribeToProcessTermination(token: ProcessToken, rejectionFunction: Function): Subscription {

    const terminateEvent = eventAggregatorSettings.messagePaths.processInstanceWithIdTerminated
      .replace(eventAggregatorSettings.messageParams.processInstanceId, token.processInstanceId);

    const onTerminatedCallback = async (message: TerminateEndEventReachedMessage): Promise<void> => {
      const eventHasMessagePayload = message !== undefined;

      const processTerminatedError = eventHasMessagePayload
        ? `Process was terminated through TerminateEndEvent '${message.flowNodeId}'!`
        : 'Process was terminated!';

      token.payload = eventHasMessagePayload
        ? message.currentToken
        : {};

      this.logger.error(processTerminatedError);

      if (eventHasMessagePayload) {
        await this.interrupt(token, true);
      } else {
        await this.interrupt(token, true, message.flowNodeInstanceId);
      }

      const terminationError = new InternalServerError(processTerminatedError);

      return rejectionFunction(terminationError);
    };

    return this.eventAggregator.subscribeOnce(terminateEvent, onTerminatedCallback);
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

    // This check is necessary to prevent duplicate entries, in case the Promise-Chain was broken further down the road.
    const noResultStoredYet = !processTokenFacade.containsResultForFlowNodeInstance(this.flowNodeInstanceId);
    if (noResultStoredYet) {
      processTokenFacade.addResultForFlowNode(this.flowNode.id, this.flowNodeInstanceId, error);
    }

    const errorBoundaryEvents = this.findErrorBoundaryEventHandlersForError(error);

    await this.afterExecute(token);

    const terminationRegex = /terminated/i;
    const isTerminationMessage = terminationRegex.test(error.message);

    const noErrorBoundaryEventsAvailable = !errorBoundaryEvents || errorBoundaryEvents.length === 0;
    if (noErrorBoundaryEventsAvailable || isTerminationMessage) {
      return rejectFunc(error);
    }

    await Promise.map(errorBoundaryEvents, async (errorHandler: ErrorBoundaryEventHandler): Promise<void> => {
      const flowNodeAfterBoundaryEvent = errorHandler.getNextFlowNode(processModelFacade);
      const errorHandlerId = errorHandler.getInstanceId();
      await this.continueAfterBoundaryEvent(errorHandlerId, flowNodeAfterBoundaryEvent, token, processTokenFacade, processModelFacade, identity);
    });

    return resolveFunc();
  }

  private async resumeWithBoundaryEvents(
    flowNodeInstanceForHandler: FlowNodeInstance,
    allFlowNodeInstances: Array<FlowNodeInstance>,
    flowNodeInstancesAfterBoundaryEvents: Array<IFlowNodeModelInstanceAssociation>,
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

      return handler.resume(matchingEntry.nextFlowNodeInstance, allFlowNodeInstances, processTokenFacade, processModelFacade, identity);
    });

    // Check if the FlowNodeInstance was placed in an interrupted state.
    // If so, it must not be resumed.
    const noInterruptingBoundaryEventsTriggered = flowNodeInstanceForHandler.state !== FlowNodeInstanceState.interrupted;
    if (noInterruptingBoundaryEventsTriggered) {
      handlerResumptionPromises.push(this.resumeFromState(flowNodeInstanceForHandler, processTokenFacade, processModelFacade, identity));
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
        boundaryEventModel: getBoundaryEventPreceedingFlowNodeInstance(fni),
        nextFlowNodeInstance: fni,
        nextFlowNode: processModelFacade.getFlowNodeById(fni.flowNodeId),
      };
    });

    const getBoundaryEventPreceedingFlowNodeInstance = (flowNodeInstance: FlowNodeInstance): Model.Events.BoundaryEvent => {
      const matchingBoundaryEventInstance =
        flowNodeInstances.find((entry: FlowNodeInstance): boolean => entry.flowNodeId === flowNodeInstance.previousFlowNodeInstanceId);

      return boundaryEvents.find((entry: Model.Events.BoundaryEvent): boolean => entry.id === matchingBoundaryEventInstance.flowNodeId);
    };

    return flowNodeModelInstanceAssociations;
  }

  // TODO: Move to BoundaryEventService.

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
  private async attachBoundaryEvents(
    currentProcessToken: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
    handlerResolve: Function,
  ): Promise<void> {

    const boundaryEventModels = processModelFacade.getBoundaryEventsFor(this.flowNode);

    const noBoundaryEventsFound = !boundaryEventModels || boundaryEventModels.length === 0;
    if (noBoundaryEventsFound) {
      return;
    }

    // Create a handler for each attached BoundaryEvent and store it in the internal collection.
    for (const model of boundaryEventModels) {
      await this.createBoundaryEventHandler(model, currentProcessToken, processTokenFacade, processModelFacade, identity, handlerResolve);
    }
  }

  private async detachBoundaryEvents(token: ProcessToken, processModelFacade: IProcessModelFacade): Promise<void> {
    for (const boundaryEventHandler of this.attachedBoundaryEventHandlers) {
      await boundaryEventHandler.cancel(token, processModelFacade);
    }

    this.attachedBoundaryEventHandlers = [];
  }

  private findErrorBoundaryEventHandlersForError(error: Error): Array<ErrorBoundaryEventHandler> {
    const errorBoundaryEventHandlers = this
      .attachedBoundaryEventHandlers
      .filter((handler: IBoundaryEventHandler): boolean => handler instanceof ErrorBoundaryEventHandler) as Array<ErrorBoundaryEventHandler>;

    const handlersForError = errorBoundaryEventHandlers.filter((handler: ErrorBoundaryEventHandler): boolean => handler.canHandleError(error));

    return handlersForError;
  }

  private async createBoundaryEventHandler(
    boundaryEventModel: Model.Events.BoundaryEvent,
    currentProcessToken: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
    handlerResolve: Function,
  ): Promise<void> {
    const boundaryEventHandler = await this.flowNodeHandlerFactory.createForBoundaryEvent(boundaryEventModel);

    // eslint-disable-next-line consistent-return
    const onBoundaryEventTriggeredCallback = async (eventData: OnBoundaryEventTriggeredData): Promise<void> => {
      // To prevent the Promise-chain from being broken too soon, we must first await the execution of the BoundaryEvent's execution path.
      // Interruption will already have happended, when this path is finished, so there is no danger of running this handler twice.
      await this.handleBoundaryEvent(eventData, currentProcessToken, processTokenFacade, processModelFacade, identity);

      if (eventData.interruptHandler) {
        return handlerResolve(undefined);
      }
    };

    await boundaryEventHandler
      .waitForTriggeringEvent(onBoundaryEventTriggeredCallback, currentProcessToken, processTokenFacade, processModelFacade, this.flowNodeInstanceId);

    this.attachedBoundaryEventHandlers.push(boundaryEventHandler);
  }

  /**
   * Callback function for handling triggered BoundaryEvents.
   *
   * This will start a new execution flow that travels down the path attached
   * to the BoundaryEvent.
   * If the triggered BoundaryEvent is interrupting, this handler and all other
   * BoundaryEvents will be canceled.
   *
   * @async
   * @param eventData           The data sent with the triggered BoundaryEvent.
   * @param currentProcessToken The current Processtoken.
   * @param processTokenFacade  The Facade for managing the ProcessInstance's
   *                            ProcessTokens.
   * @param processModelFacade  The ProcessModelFacade containing the ProcessModel.
   * @param identity            The ProcessInstance owner.
   */
  private async handleBoundaryEvent(
    eventData: OnBoundaryEventTriggeredData,
    currentProcessToken: ProcessToken,
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

    await this.continueAfterBoundaryEvent<typeof eventData.nextFlowNode>(
      eventData.boundaryInstanceId,
      eventData.nextFlowNode,
      currentProcessToken,
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

    const handlerForNextFlowNode = await this.flowNodeHandlerFactory.create<TNextFlowNode>(nextFlowNode, currentProcessToken);

    return handlerForNextFlowNode.execute(currentProcessToken, processTokenFacade, processModelFacade, identity, boundaryInstanceId);
  }

  protected async persistOnInterrupt(processToken: ProcessToken, interruptorInstanceId: string): Promise<void> {
    await this.flowNodePersistenceFacade.persistOnInterrupt(this.flowNode, this.flowNodeInstanceId, processToken, interruptorInstanceId);
  }

}
