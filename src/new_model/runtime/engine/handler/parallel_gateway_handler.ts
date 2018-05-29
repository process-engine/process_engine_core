import { IExecutionContextFascade, IFlowNodeHandler, IFlowNodeHandlerFactory,
  IProcessModelFascade, IProcessTokenFascade, Model, NextFlowNodeInfo, Runtime } from '@process-engine/process_engine_contracts';
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
                                processTokenFascade: IProcessTokenFascade,
                                processModelFascade: IProcessModelFascade,
                                executionContextFascade: IExecutionContextFascade): Promise<NextFlowNodeInfo> {

    const incomingSequenceFlows: Array<Model.Types.SequenceFlow> = processModelFascade.getIncomingSequenceFlowsFor(flowNode.id);
    const outgoingSequenceFlows: Array<Model.Types.SequenceFlow> = processModelFascade.getOutgoingSequenceFlowsFor(flowNode.id);

    const isSplitGateway: boolean = incomingSequenceFlows.length < outgoingSequenceFlows.length;

    if (isSplitGateway) {

      // first find the ParallelGateway that joins the branch back to the original branch
      const joinGateway: Model.Gateways.ParallelGateway = processModelFascade.getJoinGatewayFor(flowNode);

      // all parallel branches are only executed until the join gateway is reached
      const parallelBranchExecutionPromises: Array<Promise<NextFlowNodeInfo>> = this._executeParallelBranches(outgoingSequenceFlows,
                                                                                       joinGateway,
                                                                                       processTokenFascade,
                                                                                       processModelFascade,
                                                                                       executionContextFascade);

      // After all parallel branches have been executed, each result is merged on the ProcessTokenFascade
      const nextFlowNodeInfos: Array<NextFlowNodeInfo> = await Promise.all(parallelBranchExecutionPromises);

      for (const nextFlowNodeInfo of nextFlowNodeInfos) {
        processTokenFascade.mergeTokenHistory(nextFlowNodeInfo.processTokenFascade);
      }

      const nextFlowNode: Model.Base.FlowNode = await processModelFascade.getNextFlowNodeFor(joinGateway);

      return new NextFlowNodeInfo(nextFlowNode, processTokenFascade);
    } else {
      // TODO: Token-Methoden in Benutzerdoku beschreiben (Issue erstellen)
      return undefined;
    }
  }

  private _executeParallelBranches(outgoingSequenceFlows: Array<Model.Types.SequenceFlow>,
                                   joinGateway: Model.Gateways.ParallelGateway,
                                   processTokenFascade: IProcessTokenFascade,
                                   processModelFascade: IProcessModelFascade,
                                   executionContextFascade: IExecutionContextFascade): Array<Promise<NextFlowNodeInfo>> {

    return outgoingSequenceFlows.map(async(outgoingSequenceFlow: Model.Types.SequenceFlow): Promise<NextFlowNodeInfo> => {

      // To have an isolated ProcessToken for each branch, we fork a new ProcessToken from the original one and use it during execution of this branch
      const processTokenForBranch: IProcessTokenFascade = await processTokenFascade.getProcessTokenFascadeForParallelBranch();
      const nextFlowNodeInBranch: Model.Base.FlowNode = processModelFascade.getFlowNodeById(outgoingSequenceFlow.targetRef);

      return await this._executeBranchToJoinGateway(nextFlowNodeInBranch,
                                                    joinGateway,
                                                    processTokenForBranch,
                                                    processModelFascade,
                                                    executionContextFascade);
    });
  }

  private async _executeBranchToJoinGateway(flowNode: Model.Base.FlowNode,
                                            joinGateway: Model.Gateways.ParallelGateway,
                                            processTokenFascade: IProcessTokenFascade,
                                            processModelFascade: IProcessModelFascade,
                                            executionContextFascade: IExecutionContextFascade): Promise<NextFlowNodeInfo> {

    const flowNodeHandler: IFlowNodeHandler<Model.Base.FlowNode> = await this.flowNodeHandlerFactory.create(flowNode, processModelFascade);

    const nextFlowNodeInfo: NextFlowNodeInfo = await flowNodeHandler.execute(flowNode,
      processTokenFascade,
      processModelFascade,
      executionContextFascade);

    if (nextFlowNodeInfo.flowNode !== null && nextFlowNodeInfo.flowNode.id !== joinGateway.id) {
      return this._executeBranchToJoinGateway(nextFlowNodeInfo.flowNode,
                                              joinGateway,
                                              nextFlowNodeInfo.processTokenFascade,
                                              processModelFascade,
                                              executionContextFascade);
    }

    return new NextFlowNodeInfo(joinGateway, processTokenFascade);
  }

}
