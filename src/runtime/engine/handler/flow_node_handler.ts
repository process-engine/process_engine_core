import {
  IExecutionContextFacade,
  IFlowNodeHandler,
  IProcessModelFacade,
  IProcessTokenFacade,
  Model,
  NextFlowNodeInfo,
  Runtime,
} from '@process-engine/process_engine_contracts';

import * as uuid from 'uuid';

export abstract class FlowNodeHandler<TFlowNode extends Model.Base.FlowNode> implements IFlowNodeHandler<TFlowNode> {

  protected createFlowNodeInstanceId(): string {
    return uuid.v4();
  }

  public async execute(flowNodeInfo: NextFlowNodeInfo<TFlowNode>,
                       token: Runtime.Types.ProcessToken,
                       processTokenFacade: IProcessTokenFacade,
                       processModelFacade: IProcessModelFacade,
                       executionContextFacade: IExecutionContextFacade): Promise<NextFlowNodeInfo<Model.Base.FlowNode>> {

    let nextFlowNode: NextFlowNodeInfo<Model.Base.FlowNode>;

    try {

      // executeInternally is the method where derived handlers can implement their logic
      nextFlowNode = await this.executeInternally(flowNodeInfo, token, processTokenFacade, processModelFacade, executionContextFacade);

    } catch (error) {
      // TODO: (SM) this is only to support the old implementation
      //            I would like to set no token result or further specify it to be an error to avoid confusion
      await processTokenFacade.addResultForFlowNode(flowNodeInfo.flowNode.id, error);

      throw error;
    }

    if (!nextFlowNode) {
      throw new Error(`Next flow node after node with id "${flowNodeInfo.flowNode.id}" could not be found.`);
    }

    await this.afterExecute(flowNodeInfo.flowNode, nextFlowNode.flowNode, nextFlowNode.processTokenFacade, processModelFacade);

    return nextFlowNode;
  }

  protected async abstract executeInternally(flowNodeInfo: NextFlowNodeInfo<TFlowNode>,
                                             token: Runtime.Types.ProcessToken,
                                             processTokenFacade: IProcessTokenFacade,
                                             processModelFacade: IProcessModelFacade,
                                             executionContextFacade: IExecutionContextFacade): Promise<NextFlowNodeInfo<Model.Base.FlowNode>>;

  private async afterExecute(flowNode: TFlowNode,
                             nextFlowNode: Model.Base.FlowNode,
                             processTokenFacade: IProcessTokenFacade,
                             processModelFacade: IProcessModelFacade): Promise<void> {

    // there are two kinds of Mappers to evaluate: FlowNode- and SequenceFlow-Mappers
    // they are evaluated in between handling of FlowNodes

    await processTokenFacade.evaluateMapperForFlowNode(flowNode);

    const nextSequenceFlow: Model.Types.SequenceFlow = processModelFacade.getSequenceFlowBetween(flowNode, nextFlowNode);

    if (!nextSequenceFlow) {
      return;
    }

    await processTokenFacade.evaluateMapperForSequenceFlow(nextSequenceFlow);
  }
}
