import { IExecutionContextFacade, IFlowNodeHandler, IFlowNodeHandlerFactory,
  IProcessModelFacade, IProcessTokenFacade, Model, NextFlowNodeInfo, Runtime } from '@process-engine/process_engine_contracts';
import { FlowNodeHandler } from './index';

export class ParallelGatewayHandler extends FlowNodeHandler<Model.Gateways.ParallelGateway> {

  private _flowNodeHandlerFactory: IFlowNodeHandlerFactory;

  constructor(flowNodeHandlerFactory: IFlowNodeHandlerFactory) {
    super();
    this._flowNodeHandlerFactory = flowNodeHandlerFactory;
  }

  private get flowNodeHandlerFactory(): IFlowNodeHandlerFactory {
    return this._flowNodeHandlerFactory;
  }

  protected async executeIntern(flowNode: Model.Gateways.ParallelGateway,
                                processTokenFacade: IProcessTokenFacade,
                                processModelFacade: IProcessModelFacade,
                                executionContextFacade: IExecutionContextFacade): Promise<NextFlowNodeInfo> {

    const incomingSequenceFlows: Array<Model.Types.SequenceFlow> = processModelFacade.getIncomingSequenceFlowsFor(flowNode.id);
    const outgoingSequenceFlows: Array<Model.Types.SequenceFlow> = processModelFacade.getOutgoingSequenceFlowsFor(flowNode.id);

    const isSplitGateway: boolean = incomingSequenceFlows.length < outgoingSequenceFlows.length;

    if (isSplitGateway) {

      // first find the ParallelGateway that joins the branch back to the original branch
      const joinGateway: Model.Gateways.ParallelGateway = processModelFacade.getJoinGatewayFor(flowNode);

      // all parallel branches are only executed until the join gateway is reached
      const parallelBranchExecutionPromises: Array<Promise<NextFlowNodeInfo>> = this._executeParallelBranches(outgoingSequenceFlows,
                                                                                       joinGateway,
                                                                                       processTokenFacade,
                                                                                       processModelFacade,
                                                                                       executionContextFacade);

      // After all parallel branches have been executed, each result is merged on the ProcessTokenFacade
      const nextFlowNodeInfos: Array<NextFlowNodeInfo> = await Promise.all(parallelBranchExecutionPromises);

      for (const nextFlowNodeInfo of nextFlowNodeInfos) {
        processTokenFacade.mergeTokenHistory(nextFlowNodeInfo.processTokenFacade);
      }

      const nextFlowNode: Model.Base.FlowNode = await processModelFacade.getNextFlowNodeFor(joinGateway);

      return new NextFlowNodeInfo(nextFlowNode, processTokenFacade);
    } else {
      // TODO: Token-Methoden in Benutzerdoku beschreiben (Issue erstellen)
      return undefined;
    }
  }

  private _executeParallelBranches(outgoingSequenceFlows: Array<Model.Types.SequenceFlow>,
                                   joinGateway: Model.Gateways.ParallelGateway,
                                   processTokenFacade: IProcessTokenFacade,
                                   processModelFacade: IProcessModelFacade,
                                   executionContextFacade: IExecutionContextFacade): Array<Promise<NextFlowNodeInfo>> {

    return outgoingSequenceFlows.map(async(outgoingSequenceFlow: Model.Types.SequenceFlow): Promise<NextFlowNodeInfo> => {

      // To have an isolated ProcessToken for each branch, we fork a new ProcessToken from the original one and use it during execution of this branch
      const processTokenForBranch: IProcessTokenFacade = await processTokenFacade.getProcessTokenFacadeForParallelBranch();
      const nextFlowNodeInBranch: Model.Base.FlowNode = processModelFacade.getFlowNodeById(outgoingSequenceFlow.targetRef);

      return await this._executeBranchToJoinGateway(nextFlowNodeInBranch,
                                                    joinGateway,
                                                    processTokenForBranch,
                                                    processModelFacade,
                                                    executionContextFacade);
    });
  }

  private async _executeBranchToJoinGateway(flowNode: Model.Base.FlowNode,
                                            joinGateway: Model.Gateways.ParallelGateway,
                                            processTokenFacade: IProcessTokenFacade,
                                            processModelFacade: IProcessModelFacade,
                                            executionContextFacade: IExecutionContextFacade): Promise<NextFlowNodeInfo> {

    const flowNodeHandler: IFlowNodeHandler<Model.Base.FlowNode> = await this.flowNodeHandlerFactory.create(flowNode, processModelFacade);

    const nextFlowNodeInfo: NextFlowNodeInfo = await flowNodeHandler.execute(flowNode,
      processTokenFacade,
      processModelFacade,
      executionContextFacade);

    if (nextFlowNodeInfo.flowNode !== null && nextFlowNodeInfo.flowNode.id !== joinGateway.id) {
      return this._executeBranchToJoinGateway(nextFlowNodeInfo.flowNode,
                                              joinGateway,
                                              nextFlowNodeInfo.processTokenFacade,
                                              processModelFacade,
                                              executionContextFacade);
    }

    return new NextFlowNodeInfo(joinGateway, processTokenFacade);
  }

}