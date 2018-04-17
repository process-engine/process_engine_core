import { FlowNodeHandler } from "./flow_node_handler";
import { INodeDefEntity, IProcessTokenEntity, IFlowDefEntity, IProcessDefEntity } from "@process-engine/process_engine_contracts";
import { ExecutionContext } from "@essential-projects/core_contracts";
import { NextFlowNodeInfo } from "../next_flow_node_info";
import { GatewayHandler } from "./gateway_handler";

export class ExclusiveGatewayHandler extends GatewayHandler {
    private nextFlowNode: INodeDefEntity = undefined;
    
    public async getNextFlowNodeInfos(flowNode: INodeDefEntity, context: ExecutionContext): Promise<NextFlowNodeInfo[]> {

        if (this.nextFlowNode === undefined) {
            return [];
        }

        const nextFlowNodeInfo = new NextFlowNodeInfo();
        nextFlowNodeInfo.flowNode = this.nextFlowNode;
        nextFlowNodeInfo.shouldCreateNewToken = false;

        return [nextFlowNodeInfo];
    }

    protected async executeIntern(flowNode: INodeDefEntity, processToken: IProcessTokenEntity, context: ExecutionContext): Promise<void>  {
        const processDefinition: IProcessDefEntity = await flowNode.getProcessDef(context);
        const incomingSequenceFlows: IFlowDefEntity[] = this.getIncomingSequenceFlowsFor(flowNode.id, processDefinition);
        const outgoingSequenceFlows: IFlowDefEntity[] = this.getOutgoingSequenceFlowsFor(flowNode.id, processDefinition);

        if (incomingSequenceFlows.length > outgoingSequenceFlows.length) {
            this.nextFlowNode = this.getFlowNodeById(outgoingSequenceFlows[0].target.id, processDefinition);
        } else {
            const sequenceFlow = outgoingSequenceFlows.find(sequenceFlow => {
                return this.executeCondition(sequenceFlow.condition, processToken);
            });

            this.nextFlowNode = this.getFlowNodeById(sequenceFlow.target.id, processDefinition);
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