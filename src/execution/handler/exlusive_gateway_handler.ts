import { FlowNodeHandler } from "./flow_node_handler";
import { INodeDefEntity, IProcessTokenEntity, IFlowDefEntity, IProcessDefEntity } from "@process-engine/process_engine_contracts";
import { ExecutionContext } from "@essential-projects/core_contracts";
import { NextFlowNodeInfo } from "../next_flow_node_info";
import { GatewayHandler } from "./gateway_handler";

export class ExclusiveGatewayHandler extends GatewayHandler {

    protected async executeIntern(flowNode: INodeDefEntity, processToken: IProcessTokenEntity, context: ExecutionContext): Promise<NextFlowNodeInfo>  {
        const processDefinition: IProcessDefEntity = await flowNode.getProcessDef(context);
        const incomingSequenceFlows: IFlowDefEntity[] = this.getIncomingSequenceFlowsFor(flowNode.id, processDefinition);
        const outgoingSequenceFlows: IFlowDefEntity[] = this.getOutgoingSequenceFlowsFor(flowNode.id, processDefinition);

        if (incomingSequenceFlows.length > outgoingSequenceFlows.length) {
            return new NextFlowNodeInfo(this.getFlowNodeById(outgoingSequenceFlows[0].target.id, processDefinition), processToken);
        } else {
            const sequenceFlow = outgoingSequenceFlows.find(sequenceFlow => {
                return this.executeCondition(sequenceFlow.condition, processToken);
            });

            return new NextFlowNodeInfo(this.getFlowNodeById(sequenceFlow.target.id, processDefinition), processToken);
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