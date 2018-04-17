import { GatewayHandler } from "./gateway_handler";
import { INodeDefEntity, IProcessTokenEntity, IFlowDefEntity, IProcessDefEntity } from "@process-engine/process_engine_contracts";
import { ExecutionContext } from "@essential-projects/core_contracts";
import { NextFlowNodeInfo } from "../next_flow_node_info";

export class ParallelGatewayHandler extends GatewayHandler {
    private nextFlowNodes: INodeDefEntity[] = [];

    public async getNextFlowNodeInfos(flowNode: INodeDefEntity, context: ExecutionContext): Promise<NextFlowNodeInfo[]> {
        const nextFlowNodeInfos: NextFlowNodeInfo[] = [];

        for (const nextFlowNode of this.nextFlowNodes) {
            const nextFlowNodeInfo = new NextFlowNodeInfo();
            nextFlowNodeInfo.flowNode = nextFlowNode;
            nextFlowNodeInfo.shouldCreateNewToken = true;
            nextFlowNodeInfos.push(nextFlowNodeInfo);
        }

        return nextFlowNodeInfos;
    }

    protected async executeIntern(flowNode: INodeDefEntity, processToken: IProcessTokenEntity, context: ExecutionContext): Promise<void> {
        const processDefinition: IProcessDefEntity = await flowNode.getProcessDef(context);
        const incomingSequenceFlows: IFlowDefEntity[] = this.getIncomingSequenceFlowsFor(flowNode.id, processDefinition);
        const outgoingSequenceFlows: IFlowDefEntity[] = this.getOutgoingSequenceFlowsFor(flowNode.id, processDefinition);

        if (incomingSequenceFlows.length > outgoingSequenceFlows.length) {
            this.nextFlowNodes = [this.getFlowNodeById(outgoingSequenceFlows[0].target.id, processDefinition)];
        } else {
            for (const sequenceFlow of outgoingSequenceFlows) {
                this.nextFlowNodes.push(this.getFlowNodeById(sequenceFlow.target.id, processDefinition));
            }
        }
    }
}