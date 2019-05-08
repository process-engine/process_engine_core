import {InternalServerError} from '@essential-projects/errors_ts';
import {EventReceivedCallback, Subscription} from '@essential-projects/event_aggregator_contracts';
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
  IFlowNodeInstanceResult,
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
      try {
        this.previousFlowNodeInstanceId = previousFlowNodeInstanceId;
        token.flowNodeInstanceId = this.flowNodeInstanceId;

        this.terminationSubscription = this.subscribeToProcessTermination(token, reject);
        await this.attachBoundaryEvents(token, processTokenFacade, processModelFacade, identity, resolve);

        await this.beforeExecute(token, processTokenFacade, processModelFacade, identity);
        const nextFlowNodes = await this.executeInternally(token, processTokenFacade, processModelFacade, identity);
        await this.afterExecute(token, processTokenFacade, processModelFacade, identity);

        // EndEvents will return "undefined" as the next FlowNode.
        // So if no FlowNode is to be run next, we have arrived at the end of the current flow.
        const processIsNotYetFinished = nextFlowNodes !== undefined && nextFlowNodes.length > 0;
        if (processIsNotYetFinished) {

          const executeNextFlowNode = async (nextFlowNode: Model.Base.FlowNode): Promise<void> => {
            const nextFlowNodeHandler =
              await this.flowNodeHandlerFactory.create<Model.Base.FlowNode>(nextFlowNode, token);

            // If we must execute multiple branches, then each branch must get its own ProcessToken and Facade.
            const tokenForNextFlowNode = nextFlowNodes.length > 1
              ? processTokenFacade.createProcessToken(token.payload)
              : token;

            const processTokenFacadeForFlowNode = nextFlowNodes.length > 1
              ? processTokenFacade.getProcessTokenFacadeForParallelBranch()
              : processTokenFacade;

            tokenForNextFlowNode.flowNodeInstanceId = nextFlowNodeHandler.getInstanceId();

            return nextFlowNodeHandler
              .execute(tokenForNextFlowNode, processTokenFacadeForFlowNode, processModelFacade, identity, this.flowNodeInstanceId);
          };

          // We cannot use `Promise.map` or `Promise.each` here, because the branches would not run truly in parallel to each other.
          // The only way to guarantee that is to create the promises and then use `Promise.all` to await all of them.
          const nextFlowNodeExecutionPromises: Array<Promise<void>> = [];
          for (const nextFlowNode of nextFlowNodes) {
            nextFlowNodeExecutionPromises.push(executeNextFlowNode(nextFlowNode));
          }

          await Promise.all(nextFlowNodeExecutionPromises);
        }

        return resolve();
      } catch (error) {
        const allResults = processTokenFacade.getAllResults();
        // This check is necessary to prevent duplicate entries,
        // in case the Promise-Chain was broken further down the road.
        const noResultStoredYet = !allResults.some((entry: IFlowNodeInstanceResult): boolean => entry.flowNodeInstanceId === this.flowNodeInstanceId);
        if (noResultStoredYet) {
          processTokenFacade.addResultForFlowNode(this.flowNode.id, this.flowNodeInstanceId, error);
        }

        const errorBoundaryEvents = this.findErrorBoundaryEventHandlersForError(error);

        await this.afterExecute(token);

        const terminationRegex = /terminated/i;
        const isTerminationMessage = terminationRegex.test(error.message);

        const noErrorBoundaryEventsAvailable = !errorBoundaryEvents || errorBoundaryEvents.length === 0;
        if (noErrorBoundaryEventsAvailable || isTerminationMessage) {
          return reject(error);
        }

        token.payload = error;

        await Promise.map(errorBoundaryEvents, async (errorHandler: ErrorBoundaryEventHandler): Promise<void> => {
          const flowNodeAfterBoundaryEvent = errorHandler.getNextFlowNode(processModelFacade);
          const errorHandlerId = errorHandler.getInstanceId();
          await this.continueAfterBoundaryEvent(errorHandlerId, flowNodeAfterBoundaryEvent, token, processTokenFacade, processModelFacade, identity);
        });

        return resolve();
      }
    });
  }

  public async resume(
    flowNodeInstances: Array<FlowNodeInstance>,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<void> {

    return new Promise<void>(async (resolve: Function, reject: Function): Promise<void> => {
      try {
        const flowNodeInstance = flowNodeInstances.find((instance: FlowNodeInstance): boolean => instance.flowNodeId === this.flowNode.id);

        this.previousFlowNodeInstanceId = flowNodeInstance.previousFlowNodeInstanceId;
        this.flowNodeInstanceId = flowNodeInstance.id;

        // WIth regards to ParallelGateways, we need to be able to handle multiple results here.
        let nextFlowNodes: Array<Model.Base.FlowNode>;

        // It doesn't really matter which token is used here, since payload-specific operations should
        // only ever be done during the handlers execution.
        // We only require the token here, so that we can pass infos like ProcessInstanceId or CorrelationId to the hook.
        const tokenForHandlerHooks = flowNodeInstance.tokens[0];

        const flowNodeInstancesAfterBoundaryEvents = this.getFlowNodeInstancesAfterBoundaryEvents(flowNodeInstances, processModelFacade);

        await this.beforeExecute(tokenForHandlerHooks, processTokenFacade, processModelFacade, identity);

        if (flowNodeInstancesAfterBoundaryEvents.length === 0) {
          this.terminationSubscription = this.subscribeToProcessTermination(tokenForHandlerHooks, reject);
          await this.attachBoundaryEvents(tokenForHandlerHooks, processTokenFacade, processModelFacade, identity, resolve);

          nextFlowNodes = await this.resumeInternally(flowNodeInstance, processTokenFacade, processModelFacade, identity);
        } else {
          await this.resumeWithBoundaryEvents(
            flowNodeInstance,
            flowNodeInstancesAfterBoundaryEvents,
            flowNodeInstances,
            processTokenFacade,
            processModelFacade,
            identity,
          );
        }

        await this.afterExecute(tokenForHandlerHooks, processTokenFacade, processModelFacade, identity);

        // EndEvents will return "undefined" as the next FlowNode.
        // So if no FlowNode is returned, we have arrived at the end of the ProcessInstance.
        const processIsNotYetFinished = nextFlowNodes && nextFlowNodes.length > 0;
        if (processIsNotYetFinished) {

          // No instance for the next FlowNode was found.
          // We have arrived at the point at which the ProcessInstance was interrupted and can continue normally.
          const currentResult = processTokenFacade
            .getAllResults()
            .pop();

          const handleNextFlowNode = async (nextFlowNode: Model.Base.FlowNode): Promise<void> => {
            const processToken = processTokenFacade.createProcessToken(currentResult.result);

            const nextFlowNodeHandler = await this.flowNodeHandlerFactory.create<Model.Base.FlowNode>(nextFlowNode, processToken);

            const nextFlowNodeInstance = flowNodeInstances.find((instance: FlowNodeInstance): boolean => instance.flowNodeId === nextFlowNode.id);

            processToken.flowNodeInstanceId = nextFlowNodeInstance
              ? nextFlowNodeInstance.id
              : nextFlowNodeHandler.getInstanceId();

            // If we must execute multiple branches, then each branch must get its own ProcessToken and Facade.
            const tokenForNextFlowNode = nextFlowNodes.length > 1
              ? processTokenFacade.createProcessToken(processToken.payload)
              : processToken;

            const processTokenFacadeForFlowNode = nextFlowNodes.length > 1
              ? processTokenFacade.getProcessTokenFacadeForParallelBranch()
              : processTokenFacade;

            // An instance for the next FlowNode has already been created. Continue resuming
            if (nextFlowNodeInstance) {
              return nextFlowNodeHandler.resume(flowNodeInstances, processTokenFacadeForFlowNode, processModelFacade, identity);
            }

            return nextFlowNodeHandler
              .execute(tokenForNextFlowNode, processTokenFacadeForFlowNode, processModelFacade, identity, this.flowNodeInstanceId);
          };

          // We cannot use `Promise.map` or `Promise.each` here, because the branches would not run truly in parallel to each other.
          // The only way to guarantee that is to create the promises and then use `Promise.all` to await all of them.
          const nextFlowNodeExecutionPromises: Array<Promise<void>> = [];
          for (const nextFlowNode of nextFlowNodes) {
            nextFlowNodeExecutionPromises.push(handleNextFlowNode(nextFlowNode));
          }

          await Promise.all(nextFlowNodeExecutionPromises);
        }

        return resolve();
      } catch (error) {
        const allResults = processTokenFacade.getAllResults();
        // This check is necessary to prevent duplicate entries,
        // in case the Promise-Chain was broken further down the road.
        const noResultStoredYet = !allResults.some((entry: IFlowNodeInstanceResult): boolean => entry.flowNodeInstanceId === this.flowNodeInstanceId);
        if (noResultStoredYet) {
          processTokenFacade.addResultForFlowNode(this.flowNode.id, this.flowNodeInstanceId, error);
        }

        const token = processTokenFacade.createProcessToken();
        token.payload = error;
        token.flowNodeInstanceId = this.flowNodeInstanceId;

        const errorBoundaryEvents = this.findErrorBoundaryEventHandlersForError(error);

        await this.afterExecute(token);

        const terminationRegex = /terminated/i;
        const isTerminationMessage = terminationRegex.test(error.message);

        const noErrorBoundaryEventsAvailable = !errorBoundaryEvents || errorBoundaryEvents.length === 0;

        if (noErrorBoundaryEventsAvailable || isTerminationMessage) {
          return reject(error);
        }

        await Promise.map(errorBoundaryEvents, async (errorHandler: ErrorBoundaryEventHandler): Promise<void> => {
          const flowNodeAfterBoundaryEvent = errorHandler.getNextFlowNode(processModelFacade);
          const errorHandlerId = errorHandler.getInstanceId();
          await this.continueAfterBoundaryEvent(errorHandlerId, flowNodeAfterBoundaryEvent, token, processTokenFacade, processModelFacade, identity);
        });

        return resolve();
      }
    });
  }

  public async interrupt(token: ProcessToken, terminate?: boolean): Promise<void> {
    await this.onInterruptedCallback(token);
    await this.afterExecute(token);

    if (terminate) {
      return this.persistOnTerminate(token);
    }

    return this.persistOnExit(token);
  }

  protected async resumeInternally(
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
        const suspendToken: ProcessToken = flowNodeInstance.getTokenByType(ProcessTokenType.onSuspend);

        return this.continueAfterSuspend(flowNodeInstance, suspendToken, processTokenFacade, processModelFacade, identity);

      case FlowNodeInstanceState.running:
        const resumeToken: ProcessToken = flowNodeInstance.getTokenByType(ProcessTokenType.onResume);

        const notSuspendedYet: boolean = resumeToken === undefined;
        if (notSuspendedYet) {
          this.logger.verbose('FlowNodeInstance was interrupted at the beginning. Resuming from the start.');
          const onEnterToken: ProcessToken = flowNodeInstance.getTokenByType(ProcessTokenType.onEnter);

          return this.continueAfterEnter(onEnterToken, processTokenFacade, processModelFacade, identity);
        }

        this.logger.verbose('The FlowNodeInstance was already suspended and resumed. Finishing up the handler.');

        return this.continueAfterResume(resumeToken, processTokenFacade, processModelFacade);

      case FlowNodeInstanceState.finished:
        this.logger.verbose('FlowNodeInstance was already finished. Skipping ahead.');
        const onExitToken: ProcessToken = flowNodeInstance.getTokenByType(ProcessTokenType.onExit);

        return this.continueAfterExit(onExitToken, processTokenFacade, processModelFacade, identity);

      case FlowNodeInstanceState.error:
        this.logger.error(
          `Cannot resume FlowNodeInstance ${flowNodeInstance.id}, because it previously exited with an error!`,
          flowNodeInstance.error,
        );
        throw flowNodeInstance.error;

      case FlowNodeInstanceState.terminated:
        const terminatedError: string = `Cannot resume FlowNodeInstance ${flowNodeInstance.id}, because it was terminated!`;
        this.logger.error(terminatedError);
        throw new InternalServerError(terminatedError);

      default:
        const invalidStateError: string = `Cannot resume FlowNodeInstance ${flowNodeInstance.id}, because its state cannot be determined!`;
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

  /**
   * Resumes the given FlowNodeInstance from the point where it assumed the
   * "onSuspended" state.
   *
   * @async
   * @param   flowNodeInstance   The FlowNodeInstance to resume.
   * @param   onSuspendToken     The token the FlowNodeInstance had when it was
   *                             suspended.
   * @param   processTokenFacade The ProcessTokenFacade to use for resuming.
   * @param   processModelFacade The ProcessModelFacade to use for resuming.
   * @param   identity           The identity of the user that originally
   *                             started the ProcessInstance.
   * @returns                    The info for the next FlowNode to run.
   */
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

  /**
   * Resumes the given FlowNodeInstance from the point where it resumed activity,
   * after having been suspended.
   *
   * @async
   * @param   resumeToken        The ProcessToken stored after resuming the
   *                             FlowNodeInstance.
   * @param   processTokenFacade The ProcessTokenFacade to use for resuming.
   * @param   processModelFacade The processModelFacade to use for resuming.
   * @param   identity           The identity of the user that originally
   *                             started the ProcessInstance.
   * @returns                    The Info for the next FlowNode to run.
   */
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

  protected async persistOnSuspend(processToken: ProcessToken): Promise<void> {
    await this.flowNodePersistenceFacade.persistOnSuspend(this.flowNode, this.flowNodeInstanceId, processToken);
  }

  protected async persistOnResume(processToken: ProcessToken): Promise<void> {
    await this.flowNodePersistenceFacade.persistOnResume(this.flowNode, this.flowNodeInstanceId, processToken);
  }

  protected subscribeToProcessTermination(token: ProcessToken, rejectionFunction: Function): Subscription {

    const terminateEvent: string = eventAggregatorSettings.messagePaths.processInstanceWithIdTerminated
      .replace(eventAggregatorSettings.messageParams.processInstanceId, token.processInstanceId);

    const onTerminatedCallback: EventReceivedCallback = async (message: TerminateEndEventReachedMessage): Promise<void> => {
      const payloadIsDefined: boolean = message !== undefined;

      const processTerminatedError: string = payloadIsDefined
        ? `Process was terminated through TerminateEndEvent '${message.flowNodeId}'!`
        : 'Process was terminated!';

      token.payload = payloadIsDefined
        ? message.currentToken
        : {};

      this.logger.error(processTerminatedError);

      await this.interrupt(token, true);

      const terminationError: InternalServerError = new InternalServerError(processTerminatedError);

      return rejectionFunction(terminationError);
    };

    return this.eventAggregator.subscribeOnce(terminateEvent, onTerminatedCallback);
  }

  private async resumeWithBoundaryEvents(
    currentFlowNodeInstnace: FlowNodeInstance,
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
      return handler.resume(flowNodeInstances, processTokenFacade, processModelFacade, identity);
    });

    // Check if one of the BoundaryEvents was interrupting. If so, the handler must not be resumed.
    const noInterruptingBoundaryEventsTriggered = !flowNodeInstancesAfterBoundaryEvents
      .some((entry: IFlowNodeModelInstanceAssociation): boolean => entry.boundaryEventModel.cancelActivity === true);

    if (noInterruptingBoundaryEventsTriggered) {
      handlerResumptionPromises.push(this.resumeInternally(currentFlowNodeInstnace, processTokenFacade, processModelFacade, identity));
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

    // Createa a handler for each attached BoundaryEvent and store it in the internal collection.
    for (const model of boundaryEventModels) {
      await this.createBoundaryEventHandler(model, currentProcessToken, processTokenFacade, processModelFacade, identity, handlerResolve);
    }
  }

  /**
   * Finds and returns all ErrorBoundaryEvents that are configured to
   * handle the given error.
   *
   * @returns The retrieved ErrorBoundaryEventHandlers.
   */
  private findErrorBoundaryEventHandlersForError(error: Error): Array<ErrorBoundaryEventHandler> {
    const errorBoundaryEventHandlers = this
      .attachedBoundaryEventHandlers
      .filter((handler: IBoundaryEventHandler): boolean => handler instanceof ErrorBoundaryEventHandler) as Array<ErrorBoundaryEventHandler>;

    const handlersForError = errorBoundaryEventHandlers.filter((handler: ErrorBoundaryEventHandler): boolean => handler.canHandleError(error));

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
   * If the triggered BoundaryEvent is interrupting, this function will also cancel
   * this handler as well as all attached BoundaryEvents.
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

    const handlerForNextFlowNode: IFlowNodeHandler<TNextFlowNode> =
      await this.flowNodeHandlerFactory.create<TNextFlowNode>(nextFlowNode, currentProcessToken);

    return handlerForNextFlowNode.execute(currentProcessToken, processTokenFacade, processModelFacade, identity, boundaryInstanceId);
  }

  /**
   * Cancels and clears all BoundaryEvents attached to this handler.
   */
  private async detachBoundaryEvents(token: ProcessToken, processModelFacade: IProcessModelFacade): Promise<void> {
    for (const boundaryEventHandler of this.attachedBoundaryEventHandlers) {
      await boundaryEventHandler.cancel(token, processModelFacade);
    }

    this.attachedBoundaryEventHandlers = [];
  }

}
