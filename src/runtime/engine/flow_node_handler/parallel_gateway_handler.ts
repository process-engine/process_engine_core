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
  IProcessTokenResult,
  Model,
  NextFlowNodeInfo,
  Runtime,
  TerminateEndEventReachedMessage,
} from '@process-engine/process_engine_contracts';

import {FlowNodeHandler} from './index';

interface IProcessStateInfo {
  processTerminationSubscription?: ISubscription;
  processTerminatedMessage?: TerminateEndEventReachedMessage;
}

export class ParallelGatewayHandler extends FlowNodeHandler<Model.Gateways.ParallelGateway> {

  private _eventAggregator: IEventAggregator;
  private _flowNodeHandlerFactory: IFlowNodeHandlerFactory;

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

    const gatewayTypeIsNotSupported: boolean =
      this.parallelGateway.gatewayDirection === Model.Gateways.GatewayDirection.Unspecified ||
      this.parallelGateway.gatewayDirection === Model.Gateways.GatewayDirection.Mixed;

    if (gatewayTypeIsNotSupported) {
      const unsupportedErrorMessage: string =
        `ParallelGateway ${this.parallelGateway.id} is neither a Split- nor a Join-Gateway! Mixed Gateways are NOT supported!`;
      const unsupportedError: UnprocessableEntityError = new UnprocessableEntityError(unsupportedErrorMessage);

      this.persistOnError(token, unsupportedError);

      throw unsupportedError;
    }

    const isSplitGateway: boolean = this.parallelGateway.gatewayDirection === Model.Gateways.GatewayDirection.Diverging;

    if (isSplitGateway) {

      const processStateInfo: IProcessStateInfo = {};

      const processTerminatedEvent: string = eventAggregatorSettings.routePaths.terminateEndEventReached
        .replace(eventAggregatorSettings.routeParams.processInstanceId, token.processInstanceId);

      const processTerminationSubscription: ISubscription = this._eventAggregator
        .subscribeOnce(processTerminatedEvent, async(message: TerminateEndEventReachedMessage): Promise<void> => {
          processStateInfo.processTerminatedMessage = message;
        });

      // first find the ParallelGateway that joins the branch back to the original branch
      const outgoingSequenceFlows: Array<Model.Types.SequenceFlow> = processModelFacade.getOutgoingSequenceFlowsFor(this.parallelGateway.id);

      // The state change must be performed before the parallel branches are executed.
      // Otherwise, the Split Gateway will be in a running state, until all branches have finished.
      await this.persistOnExit(token);

      const joinGateway: Model.Gateways.ParallelGateway = await this._findJoinGateway(token, processModelFacade);

      // all parallel branches are only executed until the join gateway is reached
      const parallelBranchExecutionPromises: Array<Promise<NextFlowNodeInfo>> =
        this._executeParallelBranches(outgoingSequenceFlows,
                                      joinGateway,
                                      token,
                                      processTokenFacade,
                                      processModelFacade,
                                      identity,
                                      processStateInfo);

      // After all parallel branches have been executed, each result is merged on the ProcessTokenFacade
      const nextFlowNodeInfos: Array<NextFlowNodeInfo> = await Promise.all(parallelBranchExecutionPromises);

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

      const processTerminationSubscriptionIsActive: boolean = processTerminationSubscription !== undefined;
      if (processTerminationSubscriptionIsActive) {
        processTerminationSubscription.dispose();
      }

      const processWasTerminated: boolean = processStateInfo.processTerminatedMessage !== undefined;

      if (processWasTerminated) {
        await this.flowNodeInstanceService.persistOnTerminate(this.parallelGateway, this.flowNodeInstanceId, mergedToken);

        return new NextFlowNodeInfo(undefined, mergedToken, processTokenFacade);
      }

      return new NextFlowNodeInfo(joinGateway, mergedToken, processTokenFacade);
    }

    // This is a Join-Gateway. Just persist a state change and move on.
    const nextFlowNode: Model.Base.FlowNode = await processModelFacade.getNextFlowNodeFor(this.parallelGateway);

    await this.persistOnExit(token);

    return new NextFlowNodeInfo(nextFlowNode, token, processTokenFacade);
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

  private _executeParallelBranches(outgoingSequenceFlows: Array<Model.Types.SequenceFlow>,
                                   joinGateway: Model.Gateways.ParallelGateway,
                                   token: Runtime.Types.ProcessToken,
                                   processTokenFacade: IProcessTokenFacade,
                                   processModelFacade: IProcessModelFacade,
                                   identity: IIdentity,
                                   processStateInfo: IProcessStateInfo): Array<Promise<NextFlowNodeInfo>> {

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
                                                    processStateInfo,
                                                    this.flowNodeInstanceId);
    });
  }

  private async _executeBranchToJoinGateway(flowNode: Model.Base.FlowNode,
                                            joinGateway: Model.Gateways.ParallelGateway,
                                            token: Runtime.Types.ProcessToken,
                                            processTokenFacade: IProcessTokenFacade,
                                            processModelFacade: IProcessModelFacade,
                                            identity: IIdentity,
                                            processStateInfo: IProcessStateInfo,
                                            previousFlowNodeInstanceId: string): Promise<NextFlowNodeInfo> {

    const flowNodeHandler: IFlowNodeHandler<Model.Base.FlowNode> = await this._flowNodeHandlerFactory.create(flowNode, processModelFacade);

    const currentFlowNodeInstanceId: string = flowNodeHandler.getInstanceId();

    const nextFlowNodeInfo: NextFlowNodeInfo =
      await flowNodeHandler.execute(token, processTokenFacade, processModelFacade, identity, previousFlowNodeInstanceId);

    const processWasTerminated: boolean = processStateInfo.processTerminatedMessage !== undefined;

    if (processWasTerminated) {
      await this.flowNodeInstanceService.persistOnTerminate(flowNode, currentFlowNodeInstanceId, token);
      throw new InternalServerError(`Process was terminated through TerminateEndEvent "${processStateInfo.processTerminatedMessage.flowNodeId}".`);
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
                                              processStateInfo,
                                              currentFlowNodeInstanceId);
    }

    return new NextFlowNodeInfo(joinGateway, nextFlowNodeInfo.token, nextFlowNodeInfo.processTokenFacade);
  }

}
