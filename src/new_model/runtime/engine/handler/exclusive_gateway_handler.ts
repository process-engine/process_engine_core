import { IExecutionContextFascade, IProcessModelFascade, IProcessTokenFascade, Model,
  NextFlowNodeInfo, Runtime } from '@process-engine/process_engine_contracts';
import { FlowNodeHandler } from './flow_node_handler';

export class ExclusiveGatewayHandler extends FlowNodeHandler<Model.Gateways.ExclusiveGateway> {

  protected async executeIntern(flowNode: Model.Gateways.ExclusiveGateway,
                                processTokenFascade: IProcessTokenFascade,
                                processModelFascade: IProcessModelFascade,
                                executionContextFascade: IExecutionContextFascade): Promise<NextFlowNodeInfo> {

    const incomingSequenceFlows: Array<Model.Types.SequenceFlow> = processModelFascade.getIncomingSequenceFlowsFor(flowNode.id);
    const outgoingSequenceFlows: Array<Model.Types.SequenceFlow> = processModelFascade.getOutgoingSequenceFlowsFor(flowNode.id);

    const currentToken: any = await processTokenFascade.getOldTokenFormat();
    const current: any = processTokenFascade.addResultForFlowNode(flowNode.id, currentToken.current);

    // TODO: Robin: is this comparison really appropriate?
    if (incomingSequenceFlows.length > outgoingSequenceFlows.length) {

      const nextFlowNode: Model.Base.FlowNode = processModelFascade.getFlowNodeById(outgoingSequenceFlows[0].targetRef);

      return new NextFlowNodeInfo(nextFlowNode, processTokenFascade);

    } else {

      for (const outgoingSequenceFlow of outgoingSequenceFlows) {

        if (!outgoingSequenceFlow.conditionExpression) {
          continue;
        }

        const conditionWasPositive: boolean = await this.executeCondition(outgoingSequenceFlow.conditionExpression.expression, processTokenFascade);

        if (!conditionWasPositive) {
          continue;
        }

        const nextFlowNode: Model.Base.FlowNode = processModelFascade.getFlowNodeById(outgoingSequenceFlow.targetRef);

        return new NextFlowNodeInfo(nextFlowNode, processTokenFascade);
      }

      throw new Error('no outgoing sequence flow for exclusive gateway had a truthy condition');
    }
  }

  private async executeCondition(condition: string, processTokenFascade: IProcessTokenFascade): Promise<boolean> {
    const tokenData: any = await processTokenFascade.getOldTokenFormat();

    try {
      const functionString: string = `return ${condition}`;
      const evaluateFunction: Function = new Function('token', functionString);

      return evaluateFunction.call(tokenData, tokenData);

    } catch (err) {
      return false;
    }
  }
}
