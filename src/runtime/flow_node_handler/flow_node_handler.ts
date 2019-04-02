import {Logger} from 'loggerhythm';
import * as uuid from 'node-uuid';

import {InternalServerError} from '@essential-projects/errors_ts';
import {EventReceivedCallback, IEventAggregator, Subscription} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';

import {FlowNodeInstance, FlowNodeInstanceState, ProcessToken, ProcessTokenType} from '@process-engine/flow_node_instance.contracts';
import {
  eventAggregatorSettings,
  IBoundaryEventHandler,
  IFlowNodeHandler,
  IFlowNodeHandlerFactory,
  IFlowNodeInstanceResult,
  IFlowNodePersistenceFacade,
  IInterruptible,
  IProcessModelFacade,
  IProcessTokenFacade,
  OnBoundaryEventTriggeredCallback,
  OnBoundaryEventTriggeredData,
  onInterruptionCallback,
  ProcessTerminatedMessage,
  TerminateEndEventReachedMessage,
} from '@process-engine/process_engine_contracts';
import {Model} from '@process-engine/process_model.contracts';

import {ErrorBoundaryEventHandler} from './boundary_event_handlers/index';

interface FlowNodeModelInstanceAssociation {
  boundaryEventModel: Model.Events.BoundaryEvent;
  nextFlowNode: Model.Base.FlowNode;
  nextFlowNodeInstance: FlowNodeInstance;
}

export abstract class FlowNodeHandler<TFlowNode extends Model.Base.FlowNode> implements IFlowNodeHandler<TFlowNode>, IInterruptible {

  protected _flowNodeInstanceId: string = undefined;
  protected _flowNode: TFlowNode;
  protected _previousFlowNodeInstanceId: string;

  protected logger: Logger;

  private _eventAggregator: IEventAggregator;
  private _flowNodeHandlerFactory: IFlowNodeHandlerFactory;
  private _flowNodePersistenceFacade: IFlowNodePersistenceFacade;

  private _attachedBoundaryEventHandlers: Array<IBoundaryEventHandler> = [];

  private _terminationSubscription: Subscription;
  // tslint:disable-next-line:no-empty
  private _onInterruptedCallback: onInterruptionCallback = (): void => {};

  // tslint:disable-next-line:member-ordering
  constructor(
    eventAggregator: IEventAggregator,
    flowNodeHandlerFactory: IFlowNodeHandlerFactory,
    flowNodePersistenceFacade: IFlowNodePersistenceFacade,
    flowNode: TFlowNode,
  ) {
    this._eventAggregator = eventAggregator;
    this._flowNodeHandlerFactory = flowNodeHandlerFactory;
    this._flowNodePersistenceFacade = flowNodePersistenceFacade;
    this._flowNode = flowNode;
    this._flowNodeInstanceId = uuid.v4();
  }

  protected get eventAggregator(): IEventAggregator {
    return this._eventAggregator;
  }

  protected get flowNode(): TFlowNode {
    return this._flowNode;
  }

  protected get flowNodeHandlerFactory(): IFlowNodeHandlerFactory {
    return this._flowNodeHandlerFactory;
  }

  protected get flowNodeInstanceId(): string {
    return this._flowNodeInstanceId;
  }

  protected get previousFlowNodeInstanceId(): string {
    return this._previousFlowNodeInstanceId;
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

  public async execute(
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
    previousFlowNodeInstanceId?: string,
  ): Promise<void> {

    return new Promise<void>(async(resolve: Function, reject: Function): Promise<void> => {
      try {
        this._previousFlowNodeInstanceId = previousFlowNodeInstanceId;
        token.flowNodeInstanceId = this.flowNodeInstanceId;
        let nextFlowNodes: Array<Model.Base.FlowNode>;

        this._terminationSubscription = this._subscribeToProcessTermination(token, reject);
        await this._attachBoundaryEvents(token, processTokenFacade, processModelFacade, identity, resolve);

        await this.beforeExecute(token, processTokenFacade, processModelFacade, identity);
        nextFlowNodes = await this.executeInternally(token, processTokenFacade, processModelFacade, identity);
        await this.afterExecute(token, processTokenFacade, processModelFacade, identity);

        // EndEvents will return "undefined" as the next FlowNode.
        // So if no FlowNode is to be run next, we have arrived at the end of the current flow.
        const processIsNotYetFinished: boolean = nextFlowNodes && nextFlowNodes.length > 0;
        if (processIsNotYetFinished) {

          const executeNextFlowNode: Function = async(nextFlowNode: Model.Base.FlowNode): Promise<void> => {
            const nextFlowNodeHandler: IFlowNodeHandler<Model.Base.FlowNode> =
              await this.flowNodeHandlerFactory.create<Model.Base.FlowNode>(nextFlowNode, token);

            // If we must execute multiple branches, then each branch must get its own ProcessToken and Facade.
            const tokenForNextFlowNode: ProcessToken = nextFlowNodes.length > 1
              ? processTokenFacade.createProcessToken(token.payload)
              : token;

            const processTokenFacadeForFlowNode: IProcessTokenFacade = nextFlowNodes.length > 1
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

          return resolve();
        }
      } catch (error) {
        const allResults: Array<IFlowNodeInstanceResult> = processTokenFacade.getAllResults();
        // This check is necessary to prevent duplicate entries,
        // in case the Promise-Chain was broken further down the road.
        const noResultStoredYet: boolean = !allResults.some((entry: IFlowNodeInstanceResult) => entry.flowNodeInstanceId === this.flowNodeInstanceId);
        if (noResultStoredYet) {
          processTokenFacade.addResultForFlowNode(this.flowNode.id, this.flowNodeInstanceId, error);
        }

        const errorBoundaryEvents: Array<ErrorBoundaryEventHandler> = this._findErrorBoundaryEventHandlersForError(error);

        await this.afterExecute(token);

        const terminationRegex: RegExp = /terminated/i;
        const isTerminationMessage: boolean = terminationRegex.test(error.message);
        if (isTerminationMessage) {
          this._terminateProcessInstance(identity, token);

          return reject(error);
        }

        const noErrorBoundaryEventsAvailable: boolean = !errorBoundaryEvents || errorBoundaryEvents.length === 0;
        if (noErrorBoundaryEventsAvailable) {
          return reject(error);
        }

        token.payload = error;

        await Promise.map(errorBoundaryEvents, async(errorHandler: ErrorBoundaryEventHandler) => {
          const flowNodeAfterBoundaryEvent: Model.Base.FlowNode = errorHandler.getNextFlowNode(processModelFacade);
          const errorHandlerId: string = errorHandler.getInstanceId();
          await this._continueAfterBoundaryEvent(errorHandlerId, flowNodeAfterBoundaryEvent, token, processTokenFacade, processModelFacade, identity);
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

    return new Promise<void>(async(resolve: Function, reject: Function): Promise<void> => {
      try {
        const flowNodeInstance: FlowNodeInstance =
          flowNodeInstances.find((instance: FlowNodeInstance) => instance.flowNodeId === this.flowNode.id);

        this._previousFlowNodeInstanceId = flowNodeInstance.previousFlowNodeInstanceId;
        this._flowNodeInstanceId = flowNodeInstance.id;

        // WIth regards to ParallelGateways, we need to be able to handle multiple results here.
        let nextFlowNodes: Array<Model.Base.FlowNode>;

        // It doesn't really matter which token is used here, since payload-specific operations should
        // only ever be done during the handlers execution.
        // We only require the token here, so that we can pass infos like ProcessInstanceId or CorrelationId to the hook.
        const tokenForHandlerHooks: ProcessToken = flowNodeInstance.tokens[0];

        const flowNodeInstancesAfterBoundaryEvents: Array<FlowNodeModelInstanceAssociation> =
          this._getFlowNodeInstancesAfterBoundaryEvents(flowNodeInstances, processModelFacade);

        await this.beforeExecute(tokenForHandlerHooks, processTokenFacade, processModelFacade, identity);

        if (flowNodeInstancesAfterBoundaryEvents.length === 0) {
          this._terminationSubscription = this._subscribeToProcessTermination(tokenForHandlerHooks, reject);
          await this._attachBoundaryEvents(tokenForHandlerHooks, processTokenFacade, processModelFacade, identity, resolve);

          nextFlowNodes = await this.resumeInternally(flowNodeInstance, processTokenFacade, processModelFacade, identity);
        } else {
          await this._resumeWithBoundaryEvents(
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
        const processIsNotYetFinished: boolean = nextFlowNodes && nextFlowNodes.length > 0;
        if (processIsNotYetFinished) {

          // No instance for the next FlowNode was found.
          // We have arrived at the point at which the ProcessInstance was interrupted and can continue normally.
          const currentResult: IFlowNodeInstanceResult = processTokenFacade
            .getAllResults()
            .pop();

          const handleNextFlowNode: Function = async(nextFlowNode: Model.Base.FlowNode): Promise<void> => {
            const processToken: ProcessToken = processTokenFacade.createProcessToken(currentResult.result);

            const nextFlowNodeHandler: IFlowNodeHandler<Model.Base.FlowNode> =
              await this.flowNodeHandlerFactory.create<Model.Base.FlowNode>(nextFlowNode, processToken);

            const nextFlowNodeInstance: FlowNodeInstance =
              flowNodeInstances.find((instance: FlowNodeInstance) => instance.flowNodeId === nextFlowNode.id);

            processToken.flowNodeInstanceId = nextFlowNodeInstance
              ? nextFlowNodeInstance.id
              : nextFlowNodeHandler.getInstanceId();

            // If we must execute multiple branches, then each branch must get its own ProcessToken and Facade.
            const tokenForNextFlowNode: ProcessToken = nextFlowNodes.length > 1
              ? processTokenFacade.createProcessToken(processToken.payload)
              : processToken;

            const processTokenFacadeForFlowNode: IProcessTokenFacade = nextFlowNodes.length > 1
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
      } catch (error) {
        const allResults: Array<IFlowNodeInstanceResult> = processTokenFacade.getAllResults();
        // This check is necessary to prevent duplicate entries,
        // in case the Promise-Chain was broken further down the road.
        const noResultStoredYet: boolean = !allResults.some((entry: IFlowNodeInstanceResult) => entry.flowNodeInstanceId === this.flowNodeInstanceId);
        if (noResultStoredYet) {
          processTokenFacade.addResultForFlowNode(this.flowNode.id, this.flowNodeInstanceId, error);
        }

        const token: ProcessToken = processTokenFacade.createProcessToken();
        token.payload = error;
        token.flowNodeInstanceId = this.flowNodeInstanceId;

        const errorBoundaryEvents: Array<ErrorBoundaryEventHandler> = this._findErrorBoundaryEventHandlersForError(error);

        await this.afterExecute(token);

        const terminationRegex: RegExp = /terminated/i;
        const isTerminationMessage: boolean = terminationRegex.test(error.message);
        if (isTerminationMessage) {
          this._terminateProcessInstance(identity, token);

          return reject(error);
        }

        const noErrorBoundaryEventsAvailable: boolean = !errorBoundaryEvents || errorBoundaryEvents.length === 0;
        if (noErrorBoundaryEventsAvailable) {
          return reject(error);
        }

        await Promise.map(errorBoundaryEvents, async(errorHandler: ErrorBoundaryEventHandler) => {
          const flowNodeAfterBoundaryEvent: Model.Base.FlowNode = errorHandler.getNextFlowNode(processModelFacade);
          const errorHandlerId: string = errorHandler.getInstanceId();
          await this._continueAfterBoundaryEvent(errorHandlerId, flowNodeAfterBoundaryEvent, token, processTokenFacade, processModelFacade, identity);
        });

        return resolve();
      }
    });
  }

  public getInstanceId(): string {
    return this.flowNodeInstanceId;
  }

  public getFlowNode(): TFlowNode {
    return this.flowNode;
  }

  public async interrupt(token: ProcessToken, terminate?: boolean): Promise<void> {
    await this.onInterruptedCallback(token);
    await this.afterExecute(token);

    if (terminate) {
      return this.persistOnTerminate(token);
    }

    return this.persistOnExit(token);
  }

  /**
   * Allows each handler to perform custom preprations prior to execution.
   *
   * @async
   * @param token              The current ProcessToken.
   * @param processTokenFacade The ProcessTokenFacade of the currently
   *                           running process.
   * @param processModelFacade The ProcessModelFacade of the currently
   *                           running process.
   */
  protected async beforeExecute(
    token?: ProcessToken,
    processTokenFacade?: IProcessTokenFacade,
    processModelFacade?: IProcessModelFacade,
    identity?: IIdentity,
  ): Promise<void> {
    return Promise.resolve();
  }

  /**
   * This is the method where the derived handlers must implement their logic
   * for executing new FlowNodeInstances.
   *
   * Here, the actual execution of the FlowNodes takes place.
   *
   * @async
   * @param   token              The current ProcessToken.
   * @param   processTokenFacade The ProcessTokenFacade of the currently
   *                             running process.
   * @param   processModelFacade The ProcessModelFacade of the currently
   *                             running process.
   * @param   identity           The requesting users identity.
   * @returns                    The FlowNode that follows after this one.
   */
  protected async abstract executeInternally(
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>>;

  /**
   * Allows each handler to perform custom cleanup operations after execution.
   *
   * @async
   * @param token              The current ProcessToken.
   * @param processTokenFacade The ProcessTokenFacade of the currently
   *                           running process.
   * @param processModelFacade The ProcessModelFacade of the currently
   *                           running process.
   */
  protected async afterExecute(
    token?: ProcessToken,
    processTokenFacade?: IProcessTokenFacade,
    processModelFacade?: IProcessModelFacade,
    identity?: IIdentity,
  ): Promise<void> {
    this.eventAggregator.unsubscribe(this._terminationSubscription);
    await this._detachBoundaryEvents(token, processModelFacade);
  }

  /**
   * Handles the resumption of FlowNodeInstances.
   *
   * @async
   * @param   flowNodeInstance         The current ProcessToken.
   * @param   processTokenFacade       The ProcessTokenFacade of the currently
   *                                   running process.
   * @param   processModelFacade       The ProcessModelFacade of the currently
   *                                   running process.
   * @param   identity                 The identity of the user that originally
   *                                   started the ProcessInstance.
   * @param   processFlowNodeInstances Optional: The Process' FlowNodeInstances.
   *                                   BoundaryEvents require these.
   * @returns                          The FlowNode that follows after this one.
   */
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
        this.logger.verbose(`FlowNodeInstance was left suspended. Waiting for the resuming event to happen.`);
        const suspendToken: ProcessToken = flowNodeInstance.getTokenByType(ProcessTokenType.onSuspend);

        return this._continueAfterSuspend(flowNodeInstance, suspendToken, processTokenFacade, processModelFacade, identity);

      case FlowNodeInstanceState.running:
        const resumeToken: ProcessToken = flowNodeInstance.getTokenByType(ProcessTokenType.onResume);

        const notSuspendedYet: boolean = resumeToken === undefined;
        if (notSuspendedYet) {
          this.logger.verbose(`FlowNodeInstance was interrupted at the beginning. Resuming from the start.`);
          const onEnterToken: ProcessToken = flowNodeInstance.getTokenByType(ProcessTokenType.onEnter);

          return this._continueAfterEnter(onEnterToken, processTokenFacade, processModelFacade, identity);
        }

        this.logger.verbose(`The FlowNodeInstance was already suspended and resumed. Finishing up the handler.`);

        return this._continueAfterResume(resumeToken, processTokenFacade, processModelFacade);

      case FlowNodeInstanceState.finished:
        this.logger.verbose(`FlowNodeInstance was already finished. Skipping ahead.`);
        const onExitToken: ProcessToken = flowNodeInstance.getTokenByType(ProcessTokenType.onExit);

        return this._continueAfterExit(onExitToken, processTokenFacade, processModelFacade, identity);

      case FlowNodeInstanceState.error:
        this.logger.error(`Cannot resume FlowNodeInstance ${flowNodeInstance.id}, because it previously exited with an error!`,
                     flowNodeInstance.error);
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

  /**
   * Resumes the given FlowNodeInstance from the point its execution was
   * first started.
   *
   * @async
   * @param   onEnterToken       The token the FlowNodeInstance had when it was
   *                             started.
   * @param   processTokenFacade The ProcessTokenFacade to use for resuming.
   * @param   processModelFacade The processModelFacade to use for resuming.
   * @param   identity           The identity of the user that originally
   *                             started the ProcessInstance.
   * @returns                    The Info for the next FlowNode to run.
   */
  protected async _continueAfterEnter(
    onEnterToken: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity?: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {
    return this._executeHandler(onEnterToken, processTokenFacade, processModelFacade, identity);
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
   * @param   processModelFacade The processModelFacade to use for resuming.
   * @param   identity           The identity of the user that originally
   *                             started the ProcessInstance.
   * @returns                    The Info for the next FlowNode to run.
   */
  protected async _continueAfterSuspend(
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
  protected async _continueAfterResume(
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
   * Resumes the given FlowNodeInstance from the point it has finished execution.
   * This is used to reconstruct Token Histories.
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
  protected async _continueAfterExit(
    onExitToken: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity?: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {
    processTokenFacade.addResultForFlowNode(this.flowNode.id, this.flowNodeInstanceId, onExitToken.payload);

    return processModelFacade.getNextFlowNodesFor(this.flowNode);
  }

  /**
   * Contains all common logic for executing and resuming FlowNodeHandlers.
   *
   * @async
   * @param   token              The FlowNodeInstances current ProcessToken.
   * @param   processTokenFacade The ProcessTokenFacade to use.
   * @param   processModelFacade The processModelFacade to use.
   * @param   identity           The requesting users identity.
   * @returns                    Info about the next FlowNode to run.
   */
  protected async _executeHandler(
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity?: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {
    return processModelFacade.getNextFlowNodesFor(this.flowNode);
  }

  protected async persistOnEnter(processToken: ProcessToken): Promise<void> {
    await this._flowNodePersistenceFacade.persistOnEnter(this.flowNode, this.flowNodeInstanceId, processToken, this.previousFlowNodeInstanceId);
  }

  protected async persistOnExit(processToken: ProcessToken): Promise<void> {
    await this._flowNodePersistenceFacade.persistOnExit(this.flowNode, this.flowNodeInstanceId, processToken);
  }

  protected async persistOnTerminate(processToken: ProcessToken): Promise<void> {
    await this._flowNodePersistenceFacade.persistOnTerminate(this.flowNode, this.flowNodeInstanceId, processToken);
  }

  protected async persistOnError(processToken: ProcessToken, error: Error): Promise<void> {
    await this._flowNodePersistenceFacade.persistOnError(this.flowNode, this.flowNodeInstanceId, processToken, error);
  }

  protected async persistOnSuspend(processToken: ProcessToken): Promise<void> {
    await this._flowNodePersistenceFacade.persistOnSuspend(this.flowNode, this.flowNodeInstanceId, processToken);
  }

  protected async persistOnResume(processToken: ProcessToken): Promise<void> {
    await this._flowNodePersistenceFacade.persistOnResume(this.flowNode, this.flowNodeInstanceId, processToken);
  }

  protected _subscribeToProcessTermination(token: ProcessToken, rejectionFunction: Function): Subscription {

    const terminateEvent: string = eventAggregatorSettings.messagePaths.processInstanceWithIdTerminated
      .replace(eventAggregatorSettings.messageParams.processInstanceId, token.processInstanceId);

    const onTerminatedCallback: EventReceivedCallback = async(message: TerminateEndEventReachedMessage): Promise<void> => {
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

  private async _resumeWithBoundaryEvents(
    currentFlowNodeInstnace: FlowNodeInstance,
    flowNodeInstancesAfterBoundaryEvents: Array<FlowNodeModelInstanceAssociation>,
    flowNodeInstances: Array<FlowNodeInstance>,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<void> {
    // Resume all Paths that follow the BoundaryEvents
    const handlersToResume: Array<IFlowNodeHandler<Model.Base.FlowNode>> =
      await Promise.map(flowNodeInstancesAfterBoundaryEvents, async(entry: FlowNodeModelInstanceAssociation) => {
        return this.flowNodeHandlerFactory.create(entry.nextFlowNode);
      });

    const handlerResumptionPromises: Array<Promise<any>> = handlersToResume.map((handler: IFlowNodeHandler<Model.Base.FlowNode>) => {
      return handler.resume(flowNodeInstances, processTokenFacade, processModelFacade, identity);
    });

    // Check if one of the BoundaryEvents was interrupting. If so, the handler must not be resumed.
    const noInterruptingBoundaryEventsTriggered: boolean =
      !flowNodeInstancesAfterBoundaryEvents.some((entry: FlowNodeModelInstanceAssociation) => entry.boundaryEventModel.cancelActivity === true);
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
  private _getFlowNodeInstancesAfterBoundaryEvents(
    flowNodeInstances: Array<FlowNodeInstance>,
    processModelFacade: IProcessModelFacade,
  ): Array<FlowNodeModelInstanceAssociation> {

    const boundaryEvents: Array<Model.Events.BoundaryEvent> = processModelFacade.getBoundaryEventsFor(this.flowNode);
    if (boundaryEvents.length === 0) {
      return [];
    }

    // First get all FlowNodeInstances for the BoundaryEvents attached to this handler.
    const boundaryEventInstances: Array<FlowNodeInstance> =
      flowNodeInstances.filter((fni: FlowNodeInstance) => {
        return boundaryEvents.some((boundaryEvent: Model.Events.BoundaryEvent) => {
          return boundaryEvent.id === fni.flowNodeId;
        });
      });

    // Then get all FlowNodeInstances that followed one of the BoundaryEventInstances.
    const flowNodeInstancesAfterBoundaryEvents: Array<FlowNodeInstance> =
      flowNodeInstances.filter((fni: FlowNodeInstance) => {
        return boundaryEventInstances.some((boundaryInstance: FlowNodeInstance) => {
          return fni.previousFlowNodeInstanceId === boundaryInstance.id;
        });
      });

    const flowNodeModelInstanceAssociations: Array<FlowNodeModelInstanceAssociation> =
      flowNodeInstancesAfterBoundaryEvents.map((fni: FlowNodeInstance) => {
        return <FlowNodeModelInstanceAssociation> {
          boundaryEventModel: getBoundaryEventPreceedingFlowNodeInstance(fni),
          nextFlowNodeInstance: fni,
          nextFlowNode: processModelFacade.getFlowNodeById(fni.flowNodeId),
        };
      });

    const getBoundaryEventPreceedingFlowNodeInstance: Function = (flowNodeInstance: FlowNodeInstance): Model.Events.BoundaryEvent => {
      const matchingBoundaryEventInstance: FlowNodeInstance =
        flowNodeInstances.find((entry: FlowNodeInstance) => entry.flowNodeId === flowNodeInstance.previousFlowNodeInstanceId);

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
    currentProcessToken: ProcessToken,
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
    currentProcessToken: ProcessToken,
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
  private async _handleBoundaryEvent(
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

    await this._continueAfterBoundaryEvent<typeof eventData.nextFlowNode>(
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
  private async _continueAfterBoundaryEvent<TNextFlowNode extends Model.Base.FlowNode>(
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
  private async _detachBoundaryEvents(token: ProcessToken, processModelFacade: IProcessModelFacade): Promise<void> {
    for (const boundaryEventHandler of this._attachedBoundaryEventHandlers) {
      await boundaryEventHandler.cancel(token, processModelFacade);
    }
    this._attachedBoundaryEventHandlers = [];
  }

  private _terminateProcessInstance(identity: IIdentity, token: ProcessToken): void {

    const eventName: string = eventAggregatorSettings.messagePaths.processInstanceWithIdTerminated
      .replace(eventAggregatorSettings.messageParams.processInstanceId, token.processInstanceId);

    const message: ProcessTerminatedMessage = new ProcessTerminatedMessage(token.correlationId,
                                                                          token.processModelId,
                                                                          token.processInstanceId,
                                                                          this.flowNode.id,
                                                                          this.flowNodeInstanceId,
                                                                          identity,
                                                                          token.payload);
    // ProcessInstance specific notification
    this.eventAggregator.publish(eventName, message);
    // Global notification
    this.eventAggregator.publish(eventAggregatorSettings.messagePaths.processTerminated, message);
  }
}
