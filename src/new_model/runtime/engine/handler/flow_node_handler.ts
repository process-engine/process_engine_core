import { ExecutionContext } from '@essential-projects/core_contracts';
import { BpmnType, IExecutionContextFascade, IFlowNodeHandler, IFlowNodeHandlerFactory, IProcessModelFascade,
  IProcessTokenFascade, Model, NextFlowNodeInfo, Runtime } from '@process-engine/process_engine_contracts';

export abstract class FlowNodeHandler<TFlowNode extends Model.Base.FlowNode> implements IFlowNodeHandler<TFlowNode> {

  public async execute(flowNode: TFlowNode,
                       processTokenFascade: IProcessTokenFascade,
                       processModelFascade: IProcessModelFascade,
                       executionContextFascade: IExecutionContextFascade): Promise<NextFlowNodeInfo> {

    let nextFlowNode: NextFlowNodeInfo;

    try {

      // executeIntern is the method where derived handlers can implement their logic
      nextFlowNode = await this.executeIntern(flowNode, processTokenFascade, processModelFascade, executionContextFascade);

    } catch (error) {
      // TODO: (SM) this is only to support the old implementation
      //            I would like to set no token result or further specify it to be an error to avoid confusion
      await processTokenFascade.addResultForFlowNode(flowNode.id, error);

      throw error;
    }

    if (!nextFlowNode) {
      throw new Error(`Next flow node after node with id "${flowNode.id}" could not be found.`);
    }

    await this.afterExecute(flowNode, nextFlowNode.flowNode, processTokenFascade, processModelFascade);

    return nextFlowNode;
  }

  protected async abstract executeIntern(flowNode: TFlowNode,
                                         processTokenFascade: IProcessTokenFascade,
                                         processModelFascade: IProcessModelFascade,
                                         executionContextFascade: IExecutionContextFascade): Promise<NextFlowNodeInfo>;

  private async afterExecute(flowNode: TFlowNode,
                             nextFlowNode: Model.Base.FlowNode,
                             processTokenFascade: IProcessTokenFascade,
                             processModelFascade: IProcessModelFascade): Promise<void> {

    // there are two kinds of Mappers to evaluate: FlowNode- and SequenceFlow-Mappers
    // they are evaluated in between handling of FlowNodes

    await processTokenFascade.evaluateMapperForFlowNode(flowNode);

    const nextSequenceFlow: Model.Types.SequenceFlow = processModelFascade.getSequenceFlowBetween(flowNode, nextFlowNode);

    if (!nextSequenceFlow) {
      return;
    }

    await processTokenFascade.evaluateMapperForSequenceFlow(nextSequenceFlow);
  }
}
