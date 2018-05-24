import { Model, Runtime } from '@process-engine/process_engine_contracts';
import {
  IExecutionContextFascade,
  IProcessModelFascade,
  IProcessTokenFascade,
  NextFlowNodeInfo,
} from './../../index';
import { IFlowNodeHandler } from './iflow_node_handler';
import { IFlowNodeHandlerFactory } from './iflow_node_handler_factory';
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

    // TODO: Robin: is this comparison really appropriate?
    if (incomingSequenceFlows.length < outgoingSequenceFlows.length) {
      const joinGateway: Model.Gateways.ParallelGateway = processModelFascade.getJoinGatewayFor(flowNode);

      const promises: Array<Promise<NextFlowNodeInfo>> = outgoingSequenceFlows.map(async(outgoingSequenceFlow: Model.Types.SequenceFlow) => {

        const processTokenForBranch: IProcessTokenFascade = await processTokenFascade.getProcessTokenFascadeForParallelBranch();
        const nextFlowNodeInBranch: Model.Base.FlowNode = processModelFascade.getFlowNodeById(outgoingSequenceFlow.targetRef);

        return await this._executeBranchToJoinGateway(nextFlowNodeInBranch,
                                                      joinGateway,
                                                      processTokenForBranch,
                                                      processModelFascade,
                                                      executionContextFascade);
      });

      const nextFlowNodeInfos: Array<NextFlowNodeInfo> = await Promise.all(promises);
      for (const nextFlowNodeInfo of nextFlowNodeInfos) {
        processTokenFascade.mergeTokenHistory(nextFlowNodeInfo.processTokenFascade);
      }

      const nextFlowNode: Model.Base.FlowNode = await processModelFascade.getNextFlowNodeFor(joinGateway);

      return new NextFlowNodeInfo(nextFlowNode, processTokenFascade);
    } else {
      return null;
    }
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
