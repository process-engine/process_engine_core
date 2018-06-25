import {
  IExecutionContextFacade,
  IFlowNodeHandler,
  IFlowNodeHandlerFactory,
  IFlowNodeInstancePersistance,
  IProcessModelFacade,
  IProcessTokenFacade,
  Model,
  NextFlowNodeInfo,
  Runtime,
} from '@process-engine/process_engine_contracts';

import {FlowNodeHandler} from './index';

export class ParallelGatewayHandler extends FlowNodeHandler<Model.Gateways.ParallelGateway> {

  private _flowNodeHandlerFactory: IFlowNodeHandlerFactory = undefined;
  private _flowNodeInstancePersistance: IFlowNodeInstancePersistance = undefined;

  constructor(flowNodeHandlerFactory: IFlowNodeHandlerFactory, flowNodeInstancePersistance: IFlowNodeInstancePersistance) {
    super();
    this._flowNodeHandlerFactory = flowNodeHandlerFactory;
    this._flowNodeInstancePersistance = flowNodeInstancePersistance;
  }

  private get flowNodeHandlerFactory(): IFlowNodeHandlerFactory {
    return this._flowNodeHandlerFactory;
  }

  private get flowNodeInstancePersistance(): IFlowNodeInstancePersistance {
    return this._flowNodeInstancePersistance;
  }

  protected async executeInternally(flowNode: Model.Gateways.ParallelGateway,
                                    token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    executionContextFacade: IExecutionContextFacade): Promise<NextFlowNodeInfo> {

    const flowNodeInstanceId: string = super.createFlowNodeInstanceId();

    await this.flowNodeInstancePersistance.persistOnEnter(token, flowNode.id, flowNodeInstanceId);

    const incomingSequenceFlows: Array<Model.Types.SequenceFlow> = processModelFacade.getIncomingSequenceFlowsFor(flowNode.id);
    const outgoingSequenceFlows: Array<Model.Types.SequenceFlow> = processModelFacade.getOutgoingSequenceFlowsFor(flowNode.id);

    const isSplitGateway: boolean = incomingSequenceFlows.length < outgoingSequenceFlows.length;

    if (isSplitGateway) {

      // first find the ParallelGateway that joins the branch back to the original branch
      const joinGateway: Model.Gateways.ParallelGateway = processModelFacade.getJoinGatewayFor(flowNode);

      // all parallel branches are only executed until the join gateway is reached
      const parallelBranchExecutionPromises: Array<Promise<NextFlowNodeInfo>> = this._executeParallelBranches(outgoingSequenceFlows,
                                                                                       joinGateway,
                                                                                       token,
                                                                                       processTokenFacade,
                                                                                       processModelFacade,
                                                                                       executionContextFacade);

      // After all parallel branches have been executed, each result is merged on the ProcessTokenFacade
      const nextFlowNodeInfos: Array<NextFlowNodeInfo> = await Promise.all(parallelBranchExecutionPromises);

      for (const nextFlowNodeInfo of nextFlowNodeInfos) {
        processTokenFacade.mergeTokenHistory(nextFlowNodeInfo.processTokenFacade);
      }

      const nextFlowNode: Model.Base.FlowNode = await processModelFacade.getNextFlowNodeFor(joinGateway);

      await this.flowNodeInstancePersistance.persistOnExit(token, flowNode.id, flowNodeInstanceId);

      return new NextFlowNodeInfo(nextFlowNode, token, processTokenFacade);
    } else {
      return undefined;
    }
  }

  private _executeParallelBranches(outgoingSequenceFlows: Array<Model.Types.SequenceFlow>,
                                   joinGateway: Model.Gateways.ParallelGateway,
                                   token: Runtime.Types.ProcessToken,
                                   processTokenFacade: IProcessTokenFacade,
                                   processModelFacade: IProcessModelFacade,
                                   executionContextFacade: IExecutionContextFacade): Array<Promise<NextFlowNodeInfo>> {

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
                                                    executionContextFacade);
    });
  }

  private async _executeBranchToJoinGateway(flowNode: Model.Base.FlowNode,
                                            joinGateway: Model.Gateways.ParallelGateway,
                                            token: Runtime.Types.ProcessToken,
                                            processTokenFacade: IProcessTokenFacade,
                                            processModelFacade: IProcessModelFacade,
                                            executionContextFacade: IExecutionContextFacade): Promise<NextFlowNodeInfo> {

    const flowNodeHandler: IFlowNodeHandler<Model.Base.FlowNode> = await this.flowNodeHandlerFactory.create(flowNode, processModelFacade);

    const nextFlowNodeInfo: NextFlowNodeInfo = await flowNodeHandler.execute(flowNode,
                                                                             token,
                                                                             processTokenFacade,
                                                                             processModelFacade,
                                                                             executionContextFacade);

    if (nextFlowNodeInfo.flowNode !== null && nextFlowNodeInfo.flowNode.id !== joinGateway.id) {
      return this._executeBranchToJoinGateway(nextFlowNodeInfo.flowNode,
                                              joinGateway,
                                              nextFlowNodeInfo.token,
                                              nextFlowNodeInfo.processTokenFacade,
                                              processModelFacade,
                                              executionContextFacade);
    }

    return new NextFlowNodeInfo(joinGateway, nextFlowNodeInfo.token, nextFlowNodeInfo.processTokenFacade);
  }

}
