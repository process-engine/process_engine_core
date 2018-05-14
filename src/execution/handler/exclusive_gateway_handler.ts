import { FlowNodeHandler } from "./flow_node_handler";
import { INodeDefEntity, IProcessTokenEntity, IFlowDefEntity, IProcessDefEntity } from "@process-engine/process_engine_contracts";
import { ExecutionContext } from "@essential-projects/core_contracts";
import { NextFlowNodeInfo } from "../next_flow_node_info";
import { Model, Runtime } from '@process-engine/process_engine_contracts';
import {IProcessModelFascade} from './../index';

export class ExclusiveGatewayHandler extends FlowNodeHandler {

    protected async executeIntern(flowNode: Model.Base.FlowNode, processToken: Runtime.Types.ProcessToken, processModelFascade: IProcessModelFascade, context: ExecutionContext): Promise<NextFlowNodeInfo>  {

        const incomingSequenceFlows: Array<Model.Types.SequenceFlow> = processModelFascade.getIncomingSequenceFlowsFor(flowNode.id);
        const outgoingSequenceFlows: Array<Model.Types.SequenceFlow> = processModelFascade.getOutgoingSequenceFlowsFor(flowNode.id);

        // TODO: Robin: is this comparison really appropriate?
        if (incomingSequenceFlows.length > outgoingSequenceFlows.length) {

            const nextFlowNode: Model.Base.FlowNode = processModelFascade.getFlowNodeById(outgoingSequenceFlows[0].targetRef);
            return new NextFlowNodeInfo(nextFlowNode, processToken);

        } else {
            const nextSequenceFlow = outgoingSequenceFlows.find(sequenceFlow => {
                return this.executeCondition(sequenceFlow.condition, processToken);
            });

            if (!nextSequenceFlow) {
                throw new Error('no outgoing sequence flow for exclusive gateway had a truthy condition');
            }

            const nextFlowNode: Model.Base.FlowNode = processModelFascade.getFlowNodeById(nextSequenceFlow.targetRef);
            return new NextFlowNodeInfo(nextFlowNode, processToken);
        }
    }

    private executeCondition(condition: string, processToken: IProcessTokenEntity): boolean {
        const tokenData = processToken.data || {};

        try {
            const functionString = 'return ' + condition;
            const evaluateFunction = new Function('token', functionString);

            return evaluateFunction.call(tokenData, tokenData);

        } catch (err) {
            return false;
        }
    }
}