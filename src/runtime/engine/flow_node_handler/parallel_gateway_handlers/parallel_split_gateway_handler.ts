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

  constructor(eventAggregator: IEventAggregator,
              flowNodeHandlerFactory: IFlowNodeHandlerFactory,
              flowNodeInstanceService: IFlowNodeInstanceService,
              loggingApiService: ILoggingApi,
              metricsService: IMetricsApi,
              parallelGatewayModel: Model.Gateways.ParallelGateway) {
    super(flowNodeInstanceService, loggingApiService, metricsService, parallelGatewayModel);
    this._eventAggregator = eventAggregator;
    this._flowNodeHandlerFactory = flowNodeHandlerFactory;
  }

  private get parallelGateway(): Model.Gateways.ParallelGateway {
    return super.flowNode;
  }

  protected async executeInternally(token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    identity: IIdentity): Promise<NextFlowNodeInfo> {

    await this.persistOnEnter(token);
    this._subscribeToProcessTerminatedEvent(token.processInstanceId);

    // First, find the Join-Gateway that will finish the Parallel branches.
    const joinGateway: Model.Gateways.ParallelGateway = await this._findJoinGateway(token, processModelFacade);
    const outgoingSequenceFlows: Array<Model.Types.SequenceFlow> = processModelFacade.getOutgoingSequenceFlowsFor(this.parallelGateway.id);

    // Create Promises for each branch.
    const parallelBranchExecutionPromises: Array<Promise<NextFlowNodeInfo>> =
      this._executeParallelBranches(outgoingSequenceFlows, joinGateway, token, processTokenFacade, processModelFacade, identity);

    // The state change must be performed before the parallel branches are executed.
    // Otherwise, the Split Gateway will be in a running state, until all branches have finished.
    await this.persistOnExit(token);

    // Now await the execution of all the branches. They will only run to the point where they encounter the Join-Gateway.
    const nextFlowNodeInfos: Array<NextFlowNodeInfo> = await Promise.all(parallelBranchExecutionPromises);

    // After all parallel branches have been executed, each result is merged on the ProcessTokenFacade
    const mergedToken: Runtime.Types.ProcessToken = await this._mergeTokenHistories(processTokenFacade, nextFlowNodeInfos);

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

    const joinGatewayTypeIsNotSupported: boolean =
      joinGateway.gatewayDirection === Model.Gateways.GatewayDirection.Unspecified ||
      joinGateway.gatewayDirection === Model.Gateways.GatewayDirection.Mixed;

    if (joinGatewayTypeIsNotSupported) {
      const unsupportedErrorMessage: string =
        `ParallelGateway ${joinGateway.id} is neither a Split- nor a Join-Gateway! Mixed Gateways are NOT supported!`;
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
