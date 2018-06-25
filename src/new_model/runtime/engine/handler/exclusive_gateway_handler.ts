import {
  IExecutionContextFacade,
  IFlowNodeInstancePersistance,
  IProcessModelFacade,
  IProcessTokenFacade,
  Model,
  NextFlowNodeInfo,
  Runtime,
} from '@process-engine/process_engine_contracts';

import {FlowNodeHandler} from './index';

export class ExclusiveGatewayHandler extends FlowNodeHandler<Model.Gateways.ExclusiveGateway> {

  private _flowNodeInstancePersistance: IFlowNodeInstancePersistance = undefined;

  constructor(flowNodeInstancePersistance: IFlowNodeInstancePersistance) {
    super();
    this._flowNodeInstancePersistance = flowNodeInstancePersistance;
  }

  private get flowNodeInstancePersistance(): IFlowNodeInstancePersistance {
    return this._flowNodeInstancePersistance;
  }

  protected async executeInternally(flowNode: Model.Gateways.ExclusiveGateway,
                                    token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    executionContextFacade: IExecutionContextFacade): Promise<NextFlowNodeInfo> {

    const flowNodeInstanceId: string = super.createFlowNodeInstanceId();

    await this.flowNodeInstancePersistance.persistOnEnter(token, flowNode.id, flowNodeInstanceId);

    const incomingSequenceFlows: Array<Model.Types.SequenceFlow> = processModelFacade.getIncomingSequenceFlowsFor(flowNode.id);
    const outgoingSequenceFlows: Array<Model.Types.SequenceFlow> = processModelFacade.getOutgoingSequenceFlowsFor(flowNode.id);

    const currentToken: any = await processTokenFacade.getOldTokenFormat();
    processTokenFacade.addResultForFlowNode(flowNode.id, currentToken.current);

    const isExclusiveJoinGateway: boolean = incomingSequenceFlows.length > outgoingSequenceFlows.length;

    if (isExclusiveJoinGateway) {

      // If this is the join gateway, just return the next FlowNode to execute
      const nextFlowNode: Model.Base.FlowNode = processModelFacade.getFlowNodeById(outgoingSequenceFlows[0].targetRef);

      await this.flowNodeInstancePersistance.persistOnExit(token, flowNode.id, flowNodeInstanceId);

      return new NextFlowNodeInfo(nextFlowNode, token, processTokenFacade);
    }

    // If this is the split gateway, find the SequenceFlow that has a truthy condition
    // and continue execution with its target FlowNode.

    for (const outgoingSequenceFlow of outgoingSequenceFlows) {

      if (!outgoingSequenceFlow.conditionExpression) {
        continue;
      }

      const conditionWasPositive: boolean = await this.executeCondition(outgoingSequenceFlow.conditionExpression.expression, processTokenFacade);

      if (!conditionWasPositive) {
        continue;
      }

      const nextFlowNode: Model.Base.FlowNode = processModelFacade.getFlowNodeById(outgoingSequenceFlow.targetRef);

      await this.flowNodeInstancePersistance.persistOnExit(token, flowNode.id, flowNodeInstanceId);

      return new NextFlowNodeInfo(nextFlowNode, token, processTokenFacade);
    }

    throw new Error('no outgoing sequence flow for exclusive gateway had a truthy condition');
  }

  private async executeCondition(condition: string, processTokenFacade: IProcessTokenFacade): Promise<boolean> {
    const tokenData: any = await processTokenFacade.getOldTokenFormat();

    try {
      const functionString: string = `return ${condition}`;
      const evaluateFunction: Function = new Function('token', functionString);

      return evaluateFunction.call(tokenData, tokenData);

    } catch (err) {
      return false;
    }
  }
}
