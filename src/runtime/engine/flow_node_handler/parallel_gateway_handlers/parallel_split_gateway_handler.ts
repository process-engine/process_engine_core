import {Logger} from 'loggerhythm';

import {InternalServerError, UnprocessableEntityError} from '@essential-projects/errors_ts';
import {IEventAggregator, ISubscription} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';

import {ILoggingApi} from '@process-engine/logging_api_contracts';
import {IMetricsApi} from '@process-engine/metrics_api_contracts';
import {
  eventAggregatorSettings,
  IFlowNodeHandler,
  IFlowNodeHandlerFactory,
  IFlowNodeInstanceService,
  IProcessModelFacade,
  IProcessTokenFacade,
  Model,
  NextFlowNodeInfo,
  Runtime,
  TerminateEndEventReachedMessage,
} from '@process-engine/process_engine_contracts';

import {FlowNodeHandler} from '../index';

export class ParallelSplitGatewayHandler extends FlowNodeHandler<Model.Gateways.ParallelGateway> {

  private _eventAggregator: IEventAggregator;
  private _flowNodeHandlerFactory: IFlowNodeHandlerFactory;
  private _processTerminatedMessage: TerminateEndEventReachedMessage;

  private logger: Logger;

  constructor(eventAggregator: IEventAggregator,
              flowNodeHandlerFactory: IFlowNodeHandlerFactory,
              flowNodeInstanceService: IFlowNodeInstanceService,
              loggingApiService: ILoggingApi,
              metricsService: IMetricsApi,
              parallelGatewayModel: Model.Gateways.ParallelGateway) {
    super(flowNodeInstanceService, loggingApiService, metricsService, parallelGatewayModel);
    this._eventAggregator = eventAggregator;
    this._flowNodeHandlerFactory = flowNodeHandlerFactory;
    this.logger = Logger.createLogger(`processengine:parallel_split_gateway:${parallelGatewayModel.id}`);
  }

  private get parallelGateway(): Model.Gateways.ParallelGateway {
    return super.flowNode;
  }

  protected async executeInternally(token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    identity: IIdentity): Promise<NextFlowNodeInfo> {

    this.logger.verbose(`Executing ParallelSplitGateway instance ${this.flowNodeInstanceId}.`);
    await this.persistOnEnter(token);

    return this._executeHandler(token, processTokenFacade, processModelFacade, identity);
  }

  protected async resumeInternally(flowNodeInstance: Runtime.Types.FlowNodeInstance,
                                   processTokenFacade: IProcessTokenFacade,
                                   processModelFacade: IProcessModelFacade,
                                   identity: IIdentity,
                                  ): Promise<NextFlowNodeInfo> {

    function getFlowNodeInstanceTokenByType(tokenType: Runtime.Types.ProcessTokenType): Runtime.Types.ProcessToken {
      return flowNodeInstance.tokens.find((token: Runtime.Types.ProcessToken): boolean => {
        return token.type === tokenType;
      });
    }

    this.logger.verbose(`Resuming ParallelSplitGateway instance ${flowNodeInstance.id}.`);

    switch (flowNodeInstance.state) {
      case Runtime.Types.FlowNodeInstanceState.running:
        this.logger.verbose(`ParallelSplitGateway was unfinished. Resuming from the start.`);
        const onEnterToken: Runtime.Types.ProcessToken = getFlowNodeInstanceTokenByType(Runtime.Types.ProcessTokenType.onEnter);

        return this._continueAfterEnter(onEnterToken, processTokenFacade, processModelFacade, identity);
      case Runtime.Types.FlowNodeInstanceState.finished:
        this.logger.verbose(`ParallelSplitGateway was finished. Reconstructing branches.`);
        const onExitToken: Runtime.Types.ProcessToken = getFlowNodeInstanceTokenByType(Runtime.Types.ProcessTokenType.onExit);

        return this._continueAfterExit(onExitToken, processTokenFacade, processModelFacade, identity);
      case Runtime.Types.FlowNodeInstanceState.error:
        this.logger.error(`Cannot resume ParallelSplitGateway instance ${flowNodeInstance.id}, because it previously exited with an error!`,
                     flowNodeInstance.error);
        throw flowNodeInstance.error;
      case Runtime.Types.FlowNodeInstanceState.terminated:
        const terminatedError: string = `Cannot resume ParallelSplitGateway instance ${flowNodeInstance.id}, because it was terminated!`;
        this.logger.error(terminatedError);
        throw new InternalServerError(terminatedError);
      default:
        const invalidStateError: string =
          `Cannot resume ParallelSplitGateway instance ${flowNodeInstance.id}, because its state cannot be determined!`;
        this.logger.error(invalidStateError);
        throw new InternalServerError(invalidStateError);
    }
  }

  // We must re-run the handler, regardles of whether it was finished or only just started,
  // because we need it to reconstruct the TokenData that was created by the parallel branches.
  protected async _continueAfterExit(token: Runtime.Types.ProcessToken,
                                     processTokenFacade: IProcessTokenFacade,
                                     processModelFacade: IProcessModelFacade,
                                     identity?: IIdentity,
                                    ): Promise<NextFlowNodeInfo> {

    this.logger.verbose(`Subscribing to ProcessTerminated event.`);
    this._subscribeToProcessTerminatedEvent(token.processInstanceId);

    // TODO: This can probably be removed, when we have refactored the way we handle ParallelGateways in general.
    // For now, we need that data here for use in the parallel branches.
    // ----
    const flowNodeInstancesForProcessModel: Array<Runtime.Types.FlowNodeInstance> =
      await this.flowNodeInstanceService.queryByProcessModel(token.processModelId);

    const flowNodeInstancesForProcessInstance: Array<Runtime.Types.FlowNodeInstance> =
      flowNodeInstancesForProcessModel.filter((entry: Runtime.Types.FlowNodeInstance): boolean => {
        return entry.processInstanceId === token.processInstanceId;
      });
    // ----

    // First, find the Join-Gateway that will finish the Parallel branches.
    const joinGateway: Model.Gateways.ParallelGateway = await this._findJoinGateway(token, processModelFacade);
    const outgoingSequenceFlows: Array<Model.Types.SequenceFlow> = processModelFacade.getOutgoingSequenceFlowsFor(this.parallelGateway.id);

    // Create Promises for each branch.
    this.logger.verbose(`Executing ${outgoingSequenceFlows.length} parallel branches to the Join-Gateway.`);
    const parallelBranchExecutionPromises: Array<Promise<NextFlowNodeInfo>> =
      this._resumeParallelBranches(outgoingSequenceFlows,
                                   flowNodeInstancesForProcessInstance,
                                   joinGateway,
                                   token,
                                   processTokenFacade,
                                   processModelFacade,
                                   identity);

    // Now await the resumption of all the branches. They will only run to the point where they encounter the Join-Gateway.
    const nextFlowNodeInfos: Array<NextFlowNodeInfo> = await Promise.all(parallelBranchExecutionPromises);

    // After all parallel branches have finished, the collective results are merged into the ProcessTokenFacade.
    const mergedToken: Runtime.Types.ProcessToken = await this._mergeTokenHistories(processTokenFacade, nextFlowNodeInfos);
    this.logger.verbose(`Finished ${nextFlowNodeInfos.length} parallel branches with final result:`, mergedToken.payload);

    return new NextFlowNodeInfo(joinGateway, mergedToken, processTokenFacade);
  }

  protected async _executeHandler(token: Runtime.Types.ProcessToken,
                                  processTokenFacade: IProcessTokenFacade,
                                  processModelFacade: IProcessModelFacade,
                                  identity: IIdentity): Promise<NextFlowNodeInfo> {

    this.logger.verbose(`Subscribing to ProcessTerminated event.`);
    this._subscribeToProcessTerminatedEvent(token.processInstanceId);

    // First, find the Join-Gateway that will finish the Parallel branches.
    const joinGateway: Model.Gateways.ParallelGateway = await this._findJoinGateway(token, processModelFacade);
    const outgoingSequenceFlows: Array<Model.Types.SequenceFlow> = processModelFacade.getOutgoingSequenceFlowsFor(this.parallelGateway.id);

    // Create Promises for each branch.
    this.logger.verbose(`Executing ${outgoingSequenceFlows.length} parallel branches to the Join-Gateway.`);
    const parallelBranchExecutionPromises: Array<Promise<NextFlowNodeInfo>> =
      this._executeParallelBranches(outgoingSequenceFlows, joinGateway, token, processTokenFacade, processModelFacade, identity);

    // The state change must be performed before the parallel branches are executed.
    // Otherwise, the Split Gateway will be in a running state, until all branches have finished.
    await this.persistOnExit(token);

    // Now await the execution of all the branches. They will only run to the point where they encounter the Join-Gateway.
    const nextFlowNodeInfos: Array<NextFlowNodeInfo> = await Promise.all(parallelBranchExecutionPromises);

    // After all parallel branches have finished, the collective results are merged into the ProcessTokenFacade.
    const mergedToken: Runtime.Types.ProcessToken = await this._mergeTokenHistories(processTokenFacade, nextFlowNodeInfos);
    this.logger.verbose(`Finished ${nextFlowNodeInfos.length} parallel branches with final result:`, mergedToken.payload);

    return new NextFlowNodeInfo(joinGateway, mergedToken, processTokenFacade);
  }

  private _subscribeToProcessTerminatedEvent(processInstanceId: string): void {

    const processTerminatedEvent: string = eventAggregatorSettings.routePaths.terminateEndEventReached
      .replace(eventAggregatorSettings.routeParams.processInstanceId, processInstanceId);

    const terminateEndEventSubscription: ISubscription =
      this._eventAggregator.subscribeOnce(processTerminatedEvent, (message: TerminateEndEventReachedMessage): void => {

        this._processTerminatedMessage = message;

        const terminationSubscriptionIsActive: boolean = terminateEndEventSubscription !== undefined;
        if (terminationSubscriptionIsActive) {
          terminateEndEventSubscription.dispose();
        }
      });
  }

  private async _findJoinGateway(token: Runtime.Types.ProcessToken,
                                 processModelFacade: IProcessModelFacade): Promise<Model.Gateways.ParallelGateway> {

    // First find the ParallelGateway that joins the branch back to the original branch.
    const joinGateway: Model.Gateways.ParallelGateway = processModelFacade.getJoinGatewayFor(this.parallelGateway);
    this.logger.verbose(`Determined ParallelGateway ${joinGateway.id} as the Join-Gateway.`);

    const joinGatewayTypeIsNotSupported: boolean =
      joinGateway.gatewayDirection === Model.Gateways.GatewayDirection.Unspecified ||
      joinGateway.gatewayDirection === Model.Gateways.GatewayDirection.Mixed;

    if (joinGatewayTypeIsNotSupported) {
      const unsupportedErrorMessage: string =
        `ParallelJoinGateway ${joinGateway.id} is neither a Split- nor a Join-Gateway! Mixed Gateways are NOT supported!`;
      const unsupportedError: UnprocessableEntityError = new UnprocessableEntityError(unsupportedErrorMessage);

      await this.persistOnError(token, unsupportedError);

      throw unsupportedError;
    }

    return joinGateway;
  }

  private _executeParallelBranches(outgoingSequenceFlows: Array<Model.Types.SequenceFlow>,
                                   joinGateway: Model.Gateways.ParallelGateway,
                                   token: Runtime.Types.ProcessToken,
                                   processTokenFacade: IProcessTokenFacade,
                                   processModelFacade: IProcessModelFacade,
                                   identity: IIdentity): Array<Promise<NextFlowNodeInfo>> {

    return outgoingSequenceFlows.map(async(outgoingSequenceFlow: Model.Types.SequenceFlow): Promise<NextFlowNodeInfo> => {

      // To have an isolated ProcessToken for each branch, we fork a new ProcessToken from the original one and use it during execution of this branch
      const processTokenForBranch: IProcessTokenFacade = await processTokenFacade.getProcessTokenFacadeForParallelBranch();
      const tokenForBranch: Runtime.Types.ProcessToken = processTokenFacade.createProcessToken(token.payload);

      const nextFlowNodeInBranch: Model.Base.FlowNode = processModelFacade.getFlowNodeById(outgoingSequenceFlow.targetRef);

      return await this._executeBranchToJoinGateway(nextFlowNodeInBranch,
                                                    joinGateway,
                                                    tokenForBranch,
                                                    processTokenForBranch,
                                                    processModelFacade,
                                                    identity,
                                                    this.flowNodeInstanceId);
    });
  }

  private async _executeBranchToJoinGateway(flowNode: Model.Base.FlowNode,
                                            joinGateway: Model.Gateways.ParallelGateway,
                                            token: Runtime.Types.ProcessToken,
                                            processTokenFacade: IProcessTokenFacade,
                                            processModelFacade: IProcessModelFacade,
                                            identity: IIdentity,
                                            previousFlowNodeInstanceId: string): Promise<NextFlowNodeInfo> {

    const flowNodeHandler: IFlowNodeHandler<Model.Base.FlowNode> = await this._flowNodeHandlerFactory.create(flowNode, processModelFacade);

    const currentFlowNodeInstanceId: string = flowNodeHandler.getInstanceId();

    const nextFlowNodeInfo: NextFlowNodeInfo =
      await flowNodeHandler.execute(token, processTokenFacade, processModelFacade, identity, previousFlowNodeInstanceId);

    const processWasTerminated: boolean = this._processTerminatedMessage !== undefined;
    if (processWasTerminated) {
      await this.flowNodeInstanceService.persistOnTerminate(flowNode, currentFlowNodeInstanceId, token);
      throw new InternalServerError(`Process was terminated through TerminateEndEvent "${this._processTerminatedMessage.flowNodeId}".`);
    }

    const continueExecution: boolean =
      nextFlowNodeInfo.flowNode !== null && nextFlowNodeInfo.flowNode && nextFlowNodeInfo.flowNode.id !== joinGateway.id;
    if (continueExecution) {
      return this._executeBranchToJoinGateway(nextFlowNodeInfo.flowNode,
                                              joinGateway,
                                              nextFlowNodeInfo.token,
                                              nextFlowNodeInfo.processTokenFacade,
                                              processModelFacade,
                                              identity,
                                              currentFlowNodeInstanceId);
    }

    return new NextFlowNodeInfo(joinGateway, nextFlowNodeInfo.token, nextFlowNodeInfo.processTokenFacade);
  }

  private _resumeParallelBranches(outgoingSequenceFlows: Array<Model.Types.SequenceFlow>,
                                  flowNodeInstances: Array<Runtime.Types.FlowNodeInstance>,
                                  joinGateway: Model.Gateways.ParallelGateway,
                                  token: Runtime.Types.ProcessToken,
                                  processTokenFacade: IProcessTokenFacade,
                                  processModelFacade: IProcessModelFacade,
                                  identity: IIdentity): Array<Promise<NextFlowNodeInfo>> {

    return outgoingSequenceFlows.map(async(outgoingSequenceFlow: Model.Types.SequenceFlow): Promise<NextFlowNodeInfo> => {

      // To have an isolated ProcessToken for each branch, we fork a new ProcessToken from the original one and use it during execution of this branch
      const processTokenForBranch: IProcessTokenFacade = await processTokenFacade.getProcessTokenFacadeForParallelBranch();
      const tokenForBranch: Runtime.Types.ProcessToken = processTokenFacade.createProcessToken(token.payload);

      const firstFlowNodeInBranch: Model.Base.FlowNode = processModelFacade.getFlowNodeById(outgoingSequenceFlow.targetRef);

      const flowNodeInstanceForFirstFlowNode: Runtime.Types.FlowNodeInstance =
        flowNodeInstances.find((entry: Runtime.Types.FlowNodeInstance): boolean => {
          return entry.flowNodeId === firstFlowNodeInBranch.id;
        });

      return await this._resumeBranchToJoinGateway(firstFlowNodeInBranch,
                                                   flowNodeInstanceForFirstFlowNode,
                                                   joinGateway,
                                                   tokenForBranch,
                                                   processTokenForBranch,
                                                   processModelFacade,
                                                   identity,
                                                   flowNodeInstances);
    });
  }

  private async _resumeBranchToJoinGateway(flowNodeToResume: Model.Base.FlowNode,
                                           flowNodeInstanceForFlowNode: Runtime.Types.FlowNodeInstance,
                                           joinGateway: Model.Gateways.ParallelGateway,
                                           token: Runtime.Types.ProcessToken,
                                           processTokenFacade: IProcessTokenFacade,
                                           processModelFacade: IProcessModelFacade,
                                           identity: IIdentity,
                                           flowNodeInstancesForProcessInstance: Array<Runtime.Types.FlowNodeInstance>,
                                          ): Promise<NextFlowNodeInfo> {

    const flowNodeHandler: IFlowNodeHandler<Model.Base.FlowNode> = await this._flowNodeHandlerFactory.create(flowNodeToResume, processModelFacade);

    const nextFlowNodeInfo: NextFlowNodeInfo =
      await flowNodeHandler.resume(flowNodeInstanceForFlowNode, processTokenFacade, processModelFacade, identity);

    const processWasTerminated: boolean = this._processTerminatedMessage !== undefined;
    if (processWasTerminated) {
      await this.flowNodeInstanceService.persistOnTerminate(flowNodeToResume, flowNodeInstanceForFlowNode.id, token);
      throw new InternalServerError(`Process was terminated through TerminateEndEvent "${this._processTerminatedMessage.flowNodeId}".`);
    }

    // If the next FlowNode is the JoinGateway for this branch, then the branch has finished.
    const nextFlowNodeIsJoinGateway: boolean =
      nextFlowNodeInfo.flowNode !== null && nextFlowNodeInfo.flowNode && nextFlowNodeInfo.flowNode.id !== joinGateway.id;
    if (nextFlowNodeIsJoinGateway) {
      return new NextFlowNodeInfo(joinGateway, nextFlowNodeInfo.token, nextFlowNodeInfo.processTokenFacade);
    }

    // Check if a FlowNodeInstance for the next FlowNode has already been persisted
    // during a previous execution of the ProcessInstance.
    const flowNodeInstanceForNextFlowNode: Runtime.Types.FlowNodeInstance =
      flowNodeInstancesForProcessInstance.find((entry: Runtime.Types.FlowNodeInstance): boolean => {
        return entry.flowNodeId === nextFlowNodeInfo.flowNode.id;
      });

    const resumingNotFinished: boolean = flowNodeInstanceForNextFlowNode !== undefined;
    if (resumingNotFinished) {
      this.logger.info(`Resuming FlowNode ${flowNodeInstanceForNextFlowNode.flowNodeId} for ParallelGateway instance ${this.flowNodeInstanceId}.`);
      // If a matching FlowNodeInstance exists, continue resuming.
      await this._resumeBranchToJoinGateway(nextFlowNodeInfo.flowNode,
                                            flowNodeInstanceForNextFlowNode,
                                            joinGateway,
                                            nextFlowNodeInfo.token,
                                            nextFlowNodeInfo.processTokenFacade,
                                            processModelFacade,
                                            identity,
                                            flowNodeInstancesForProcessInstance);
    } else {
      // Otherwise, we will have arrived at the point at which the branch was previously interrupted,
      // and we can continue with normal execution.
      this.logger.info(`All interrupted FlowNodeInstances resumed and finished.`);
      this.logger.info(`Continuing parallel branch in ParallelGateway instance ${this.flowNodeInstanceId} normally.`);
      await this._executeBranchToJoinGateway(nextFlowNodeInfo.flowNode,
                                             joinGateway,
                                             nextFlowNodeInfo.token,
                                             nextFlowNodeInfo.processTokenFacade,
                                             processModelFacade,
                                             identity,
                                             flowNodeInstanceForFlowNode.id);
    }

  }

  private async _mergeTokenHistories(processTokenFacade: IProcessTokenFacade,
                                     nextFlowNodeInfos: Array<NextFlowNodeInfo>,
                                    ): Promise<Runtime.Types.ProcessToken> {

    const mergedToken: Runtime.Types.ProcessToken = this._getEmptyProcessToken();
    for (const nextFlowNodeInfo of nextFlowNodeInfos) {
      processTokenFacade.mergeTokenHistory(nextFlowNodeInfo.processTokenFacade);
      const nextFlowNodeInfoToken: Runtime.Types.ProcessToken = nextFlowNodeInfo.token;

      const flowNode: Runtime.Types.FlowNodeInstance =
        await this.flowNodeInstanceService.queryByInstanceId(nextFlowNodeInfo.token.flowNodeInstanceId);
      const flowNodeId: string = flowNode.flowNodeId;

      nextFlowNodeInfoToken.payload = {[`${flowNodeId}`]: nextFlowNodeInfoToken.payload};

      const payloadIsNotEmpty: boolean = mergedToken.payload !== undefined;
      if (payloadIsNotEmpty) {
        Object.assign(nextFlowNodeInfoToken.payload, mergedToken.payload);
      }

      Object.assign(mergedToken, nextFlowNodeInfoToken);
    }

    return mergedToken;
  }

  private _getEmptyProcessToken(): Runtime.Types.ProcessToken {
    const emptyProcessToken: Runtime.Types.ProcessToken = {
      processInstanceId: undefined,
      processModelId: undefined,
      correlationId: undefined,
      flowNodeInstanceId: undefined,
      identity: undefined,
      createdAt: undefined,
      caller: undefined,
      type: undefined,
      payload: undefined,
    };

    return emptyProcessToken;
  }
}
