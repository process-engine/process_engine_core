import {
  IExecutionContextFacade,
  IFlowNodeHandler,
  IFlowNodeHandlerFactory,
  IFlowNodeInstanceService,
  IProcessModelFacade,
  IProcessTokenFacade,
  Model,
  NextFlowNodeInfo,
  Runtime,
} from '@process-engine/process_engine_contracts';

import {FlowNodeHandler} from './index';

export class ParallelGatewayHandler extends FlowNodeHandler<Model.Gateways.ParallelGateway> {

  private _flowNodeHandlerFactory: IFlowNodeHandlerFactory = undefined;
  private _flowNodeInstanceService: IFlowNodeInstanceService = undefined;

  constructor(flowNodeHandlerFactory: IFlowNodeHandlerFactory, flowNodeInstanceService: IFlowNodeInstanceService) {
    super();
    this._flowNodeHandlerFactory = flowNodeHandlerFactory;
    this._flowNodeInstanceService = flowNodeInstanceService;
  }

  private get flowNodeHandlerFactory(): IFlowNodeHandlerFactory {
    return this._flowNodeHandlerFactory;
  }

  private get flowNodeInstanceService(): IFlowNodeInstanceService {
    return this._flowNodeInstanceService;
  }

  protected async executeInternally(flowNodeInfo: NextFlowNodeInfo<Model.Gateways.ParallelGateway>,
                                    token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    executionContextFacade: IExecutionContextFacade): Promise<NextFlowNodeInfo<any>> {

    const flowNodeInstanceId: string = super.createFlowNodeInstanceId();
    const flowNode: Model.Gateways.ParallelGateway = flowNodeInfo.flowNode;

    await this.flowNodeInstanceService.persistOnEnter(executionContextFacade, token, flowNode.id, flowNodeInstanceId);

    const incomingSequenceFlows: Array<Model.Types.SequenceFlow> = processModelFacade.getIncomingSequenceFlowsFor(flowNode.id);
    const outgoingSequenceFlows: Array<Model.Types.SequenceFlow> = processModelFacade.getOutgoingSequenceFlowsFor(flowNode.id);

    const isSplitGateway: boolean = incomingSequenceFlows.length < outgoingSequenceFlows.length;

    if (isSplitGateway) {

      // first find the ParallelGateway that joins the branch back to the original branch
      const joinGateway: Model.Gateways.ParallelGateway = processModelFacade.getJoinGatewayFor(flowNode);

      // all parallel branches are only executed until the join gateway is reached
      const parallelBranchExecutionPromises: Array<Promise<NextFlowNodeInfo<any>>> =
        this._executeParallelBranches(outgoingSequenceFlows,
                                      joinGateway,
                                      token,
                                      processTokenFacade,
                                      processModelFacade,
                                      executionContextFacade);

      // After all parallel branches have been executed, each result is merged on the ProcessTokenFacade
      const nextFlowNodeInfos: Array<NextFlowNodeInfo<any>> = await Promise.all(parallelBranchExecutionPromises);

      for (const nextFlowNodeInfo of nextFlowNodeInfos) {
        processTokenFacade.mergeTokenHistory(nextFlowNodeInfo.processTokenFacade);
      }

      const nextFlowNode: Model.Base.FlowNode = await processModelFacade.getNextFlowNodeFor(joinGateway);

      await this.flowNodeInstanceService.persistOnExit(executionContextFacade, token, flowNode.id, flowNodeInstanceId);

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
                                   executionContextFacade: IExecutionContextFacade): Array<Promise<NextFlowNodeInfo<any>>> {

    return outgoingSequenceFlows.map(async(outgoingSequenceFlow: Model.Types.SequenceFlow): Promise<NextFlowNodeInfo<any>> => {

      // To have an isolated ProcessToken for each branch, we fork a new ProcessToken from the original one and use it during execution of this branch
      const processTokenForBranch: IProcessTokenFacade = await processTokenFacade.getProcessTokenFacadeForParallelBranch();
      const tokenForBranch: Runtime.Types.ProcessToken = processTokenFacade.createProcessToken(token.payload);

      const nextFlowNodeInBranch: Model.Base.FlowNode = processModelFacade.getFlowNodeById(outgoingSequenceFlow.targetRef);

      const nextFlowNodeInBranchInfo: NextFlowNodeInfo<Model.Base.FlowNode> =
        new NextFlowNodeInfo(nextFlowNodeInBranch,
                             tokenForBranch,
                             processTokenForBranch);

      return await this._executeBranchToJoinGateway(nextFlowNodeInBranchInfo,
                                                    joinGateway,
                                                    tokenForBranch,
                                                    processTokenForBranch,
                                                    processModelFacade,
                                                    executionContextFacade);
    });
  }

  private async _executeBranchToJoinGateway(flowNodeInfo: NextFlowNodeInfo<Model.Base.FlowNode>,
                                            joinGateway: Model.Gateways.ParallelGateway,
                                            token: Runtime.Types.ProcessToken,
                                            processTokenFacade: IProcessTokenFacade,
                                            processModelFacade: IProcessModelFacade,
                                            executionContextFacade: IExecutionContextFacade): Promise<NextFlowNodeInfo<any>> {

    const flowNode: Model.Events.IntermediateCatchEvent = flowNodeInfo.flowNode;

    const flowNodeHandler: IFlowNodeHandler<Model.Base.FlowNode> = await this.flowNodeHandlerFactory.create(flowNode, processModelFacade);

    const nextFlowNodeInfo: NextFlowNodeInfo<Model.Base.FlowNode> = await flowNodeHandler.execute(flowNodeInfo,
                                                                                  token,
                                                                                  processTokenFacade,
                                                                                  processModelFacade,
                                                                                  executionContextFacade);

    const nextFlowNode: Model.Base.FlowNode = nextFlowNodeInfo.flowNode;

    if (nextFlowNode !== null && nextFlowNode.id !== joinGateway.id) {
      return this._executeBranchToJoinGateway(nextFlowNodeInfo,
                                              joinGateway,
                                              nextFlowNodeInfo.token,
                                              nextFlowNodeInfo.processTokenFacade,
                                              processModelFacade,
                                              executionContextFacade);
    }

    return new NextFlowNodeInfo(joinGateway, nextFlowNodeInfo.token, nextFlowNodeInfo.processTokenFacade);
  }

}
