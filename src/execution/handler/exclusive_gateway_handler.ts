import { FlowNodeHandler } from "./flow_node_handler";
import { INodeDefEntity, IProcessTokenEntity, IFlowDefEntity, IProcessDefEntity, BpmnType } from "@process-engine/process_engine_contracts";
import { ExecutionContext } from "@essential-projects/core_contracts";
import { NextFlowNodeInfo } from "../next_flow_node_info";
import { Model, Runtime } from '@process-engine/process_engine_contracts';
import {IProcessModelFascade, IProcessTokenFascade} from './../index';

export class ExclusiveGatewayHandler extends FlowNodeHandler<Model.Gateways.ExclusiveGateway> {

    protected async executeIntern(flowNode: Model.Gateways.ExclusiveGateway, processTokenFascade: IProcessTokenFascade, processModelFascade: IProcessModelFascade): Promise<NextFlowNodeInfo>  {

        const incomingSequenceFlows: Array<Model.Types.SequenceFlow> = processModelFascade.getIncomingSequenceFlowsFor(flowNode.id);
        const outgoingSequenceFlows: Array<Model.Types.SequenceFlow> = processModelFascade.getOutgoingSequenceFlowsFor(flowNode.id);

        // TODO: Robin: is this comparison really appropriate?
        if (incomingSequenceFlows.length > outgoingSequenceFlows.length) {

            const nextFlowNode: Model.Base.FlowNode = processModelFascade.getFlowNodeById(outgoingSequenceFlows[0].targetRef);
            return new NextFlowNodeInfo(nextFlowNode, processTokenFascade);

        } else {
            const nextSequenceFlow: Model.Types.SequenceFlow = outgoingSequenceFlows.find(sequenceFlow => {
                
                if (!sequenceFlow.conditionExpression) {
                    return false;
                }
                return this.executeCondition(sequenceFlow.conditionExpression.expression, processTokenFascade);
            });

            if (!nextSequenceFlow) {
                throw new Error('no outgoing sequence flow for exclusive gateway had a truthy condition');
            }

            const nextFlowNode: Model.Base.FlowNode = processModelFascade.getFlowNodeById(nextSequenceFlow.targetRef);
            return new NextFlowNodeInfo(nextFlowNode, processTokenFascade);
        }
    }

    private executeCondition(condition: string, processTokenFascade: IProcessTokenFascade): boolean {
        const tokenData = processTokenFascade.getOldTokenFormat();

        try {
            const functionString = 'return ' + condition;
            const evaluateFunction = new Function('token', functionString);

            return evaluateFunction.call(tokenData, tokenData);

        } catch (err) {
            return false;
        }
    }
}