import {Logger} from 'loggerhythm';
import * as uuid from 'node-uuid';

import {InternalServerError} from '@essential-projects/errors_ts';
import {IEventAggregator, Subscription} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';

import {FlowNodeInstance, Model, ProcessToken} from '@process-engine/persistence_api.contracts';
import {
  IFlowNodeHandler,
  IFlowNodeHandlerFactory,
  IFlowNodeInstanceResult,
  IFlowNodePersistenceFacade,
  IProcessModelFacade,
  IProcessTokenFacade,
  ProcessErrorMessage,
  eventAggregatorSettings,
  onInterruptionCallback,
} from '@process-engine/process_engine_contracts';

export abstract class FlowNodeHandler<TFlowNode extends Model.Base.FlowNode> implements IFlowNodeHandler<TFlowNode> {

  protected flowNodeInstanceId: string = undefined;
  protected flowNode: TFlowNode;
  protected previousFlowNodeInstanceId: string;

  protected terminationSubscription: Subscription;
  protected processErrorSubscription: Subscription;

  protected logger: Logger;

  protected eventAggregator: IEventAggregator;
  protected flowNodeHandlerFactory: IFlowNodeHandlerFactory;
  protected flowNodePersistenceFacade: IFlowNodePersistenceFacade;

  constructor(
    eventAggregator: IEventAggregator,
    flowNodeHandlerFactory: IFlowNodeHandlerFactory,
    flowNodePersistenceFacade: IFlowNodePersistenceFacade,
    flowNode: TFlowNode,
  ) {
    this.eventAggregator = eventAggregator;
    this.flowNodeHandlerFactory = flowNodeHandlerFactory;
    this.flowNodePersistenceFacade = flowNodePersistenceFacade;
    this.flowNode = flowNode;
    this.flowNodeInstanceId = uuid.v4();
  }

  // eslint-disable-next-line @typescript-eslint/member-naming
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

  protected set onInterruptedCallback(value: onInterruptionCallback) {
    this._onInterruptedCallback = value;
  }

  public getInstanceId(): string {
    return this.flowNodeInstanceId;
  }

  public getFlowNode(): TFlowNode {
    return this.flowNode;
  }

  public abstract async execute(
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
    previousFlowNodeInstanceId?: string,
  ): Promise<void>;

  public abstract async resume(
    flowNodeInstanceForHandler: FlowNodeInstance,
    allFlowNodeInstances: Array<FlowNodeInstance>,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<void>;

  protected async beforeExecute(
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<void> {
    return Promise.resolve();
  }

  protected async afterExecute(
    token?: ProcessToken,
    processTokenFacade?: IProcessTokenFacade,
    processModelFacade?: IProcessModelFacade,
    identity?: IIdentity,
  ): Promise<void> {
    this.eventAggregator.unsubscribe(this.processErrorSubscription);
    this.eventAggregator.unsubscribe(this.terminationSubscription);
  }

  // TODO: Move to "FlowNodeExecutionService"
  /**
   * Hook for starting the execution of FlowNodes.
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
  protected async abstract startExecution(
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>>;

  // TODO: Move to "FlowNodeResumptionService"
  /**
   * Hook for starting the resumption of FlowNodes.
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
  protected abstract async resumeFromState(
    flowNodeInstance: FlowNodeInstance,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
    processFlowNodeInstances?: Array<FlowNodeInstance>,
  ): Promise<Array<Model.Base.FlowNode>>;

  protected async continueAfterEnter(
    onEnterToken: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity?: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {
    return this.executeHandler(onEnterToken, processTokenFacade, processModelFacade, identity);
  }

  protected async continueAfterExit(
    onExitToken: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity?: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {
    processTokenFacade.addResultForFlowNode(this.flowNode.id, this.flowNodeInstanceId, onExitToken.payload);

    return processModelFacade.getNextFlowNodesFor(this.flowNode);
  }

  /**
   * Main hook for executing and resuming FlowNodeHandlers from the start.
   *
   * @async
   * @param   token              The FlowNodeInstances current ProcessToken.
   * @param   processTokenFacade The ProcessTokenFacade to use.
   * @param   processModelFacade The processModelFacade to use.
   * @param   identity           The requesting users identity.
   * @returns                    Info about the next FlowNode to run.
   */
  protected async executeHandler(
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity?: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {
    return processModelFacade.getNextFlowNodesFor(this.flowNode);
  }

  protected async persistOnEnter(processToken: ProcessToken, previousFlowNodeInstanceIds?: Array<string>): Promise<void> {

    const previousFlowNodeInstanceIdToPersist = previousFlowNodeInstanceIds
      ? previousFlowNodeInstanceIds.join(';')
      : this.previousFlowNodeInstanceId;

    await this.flowNodePersistenceFacade.persistOnEnter(this.flowNode, this.flowNodeInstanceId, processToken, previousFlowNodeInstanceIdToPersist);
  }

  protected async persistOnSuspend(processToken: ProcessToken): Promise<void> {
    await this.flowNodePersistenceFacade.persistOnSuspend(this.flowNode, this.flowNodeInstanceId, processToken);
  }

  protected async persistOnResume(processToken: ProcessToken): Promise<void> {
    await this.flowNodePersistenceFacade.persistOnResume(this.flowNode, this.flowNodeInstanceId, processToken);
  }

  protected async persistOnExit(processToken: ProcessToken): Promise<void> {
    await this.flowNodePersistenceFacade.persistOnExit(this.flowNode, this.flowNodeInstanceId, processToken);
  }

  protected async persistOnTerminate(processToken: ProcessToken): Promise<void> {
    await this.flowNodePersistenceFacade.persistOnTerminate(this.flowNode, this.flowNodeInstanceId, processToken);
  }

  protected async persistOnError(processToken: ProcessToken, error: Error): Promise<void> {
    await this.flowNodePersistenceFacade.persistOnError(this.flowNode, this.flowNodeInstanceId, processToken, error);
  }

  protected subscribeToProcessTermination(token: ProcessToken, rejectionFunction: Function): Subscription {

    const terminateEvent = eventAggregatorSettings.messagePaths.processInstanceWithIdTerminated
      .replace(eventAggregatorSettings.messageParams.processInstanceId, token.processInstanceId);

    const onTerminatedCallback = async (message: any): Promise<void> => {
      const terminatedByEndEvent = message?.flowNodeId != undefined;
      const terminationUserId = message?.terminatedBy?.userId ?? undefined;

      const processTerminatedError = terminatedByEndEvent
        ? `Process was terminated through TerminateEndEvent '${message.flowNodeId}'`
        : `Process was terminated by user ${terminationUserId}`;

      token.payload = terminatedByEndEvent
        ? message.currentToken
        : {};

      await this.onInterruptedCallback(token);
      await this.afterExecute(token);
      await this.persistOnTerminate(token);

      const terminationError = new InternalServerError(processTerminatedError);

      if (message.terminatedBy) {
        terminationError.additionalInformation = {
          terminatedBy: message.terminatedBy,
        };
      }

      return rejectionFunction(terminationError);
    };

    return this.eventAggregator.subscribeOnce(terminateEvent, onTerminatedCallback);
  }

  protected subscribeToProcessError(token: ProcessToken, rejectionFunction: Function): Subscription {

    const errorEvent = eventAggregatorSettings.messagePaths.processInstanceWithIdErrored
      .replace(eventAggregatorSettings.messageParams.processInstanceId, token.processInstanceId);

    const onErroredCallback = async (message: ProcessErrorMessage): Promise<void> => {

      const payloadIsDefined = message != undefined;

      token.payload = payloadIsDefined
        ? message.currentToken
        : {};

      const error = new InternalServerError('ProcessInstance encountered an error!');
      error.additionalInformation = message.currentToken;

      await this.onInterruptedCallback(token);
      await this.afterExecute(token);
      await this.persistOnError(token, error);

      return rejectionFunction(error);
    };

    return this.eventAggregator.subscribeOnce(errorEvent, onErroredCallback);
  }

  protected findNextInstanceOfFlowNode(allFlowNodeInstances: Array<FlowNodeInstance>, nextFlowNodeId: string): FlowNodeInstance {

    return allFlowNodeInstances.find((instance: FlowNodeInstance): boolean => {

      // ParallelJoinGateways always have multiple "previousFlowNodeInstanceIds".
      // These IDs are separated by ";", i.e.: ID1;ID2;ID3, etc.
      // We need to account for that fact here.
      // indexOf will return 0, if the two IDs are exact matches.
      const instanceFollowedCurrentFlowNode =
        instance.previousFlowNodeInstanceId &&
        instance.previousFlowNodeInstanceId.indexOf(this.flowNodeInstanceId) > -1;

      const flowNodeIdsMatch = instance.flowNodeId === nextFlowNodeId;

      return instanceFollowedCurrentFlowNode && flowNodeIdsMatch;
    });
  }

  protected async handleNextFlowNode(
    nextFlowNode: Model.Base.FlowNode,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    processToken: ProcessToken,
    identity: IIdentity,
    nextFlowNodeInstance?: FlowNodeInstance,
    allFlowNodeInstances?: Array<FlowNodeInstance>,
  ): Promise<void> {

    const nextFlowNodeHandler = await this.flowNodeHandlerFactory.create<Model.Base.FlowNode>(nextFlowNode, processToken);

    processToken.flowNodeInstanceId = nextFlowNodeInstance
      ? nextFlowNodeInstance.id
      : nextFlowNodeHandler.getInstanceId();

    // Providing FlowNodeInstances means that we are resuming a process.
    // Normal process execution doesn't know about any FlowNodeInstances.
    if (nextFlowNodeInstance) {
      return nextFlowNodeHandler
        .resume(nextFlowNodeInstance, allFlowNodeInstances, processTokenFacade, processModelFacade, identity);
    }

    // No FlowNodeInstance is given. The Process is executed normally.
    return nextFlowNodeHandler
      .execute(processToken, processTokenFacade, processModelFacade, identity, this.flowNodeInstanceId);
  }

  protected async handleError(token: ProcessToken, error: Error, processTokenFacade: IProcessTokenFacade, rejectCallback: Function): Promise<void> {

    token.payload = error;

    // This check is necessary to prevent duplicate entries, in case the Promise-Chain was broken further down the road.
    const allResults = processTokenFacade.getAllResults();

    const noResultStoredYet = !allResults.some((entry: IFlowNodeInstanceResult): boolean => entry.flowNodeInstanceId === this.flowNodeInstanceId);
    if (noResultStoredYet) {
      processTokenFacade.addResultForFlowNode(this.flowNode.id, this.flowNodeInstanceId, token);
    }

    await this.afterExecute(token);

    return rejectCallback(error);
  }

}
