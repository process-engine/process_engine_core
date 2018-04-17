import { FlowNodeHandler } from "./flow_node_handler";
import { IFlowDefEntity, IProcessDefEntity } from "@process-engine/process_engine_contracts";

export abstract class GatewayHandler extends FlowNodeHandler {

    protected getIncomingSequenceFlowsFor(flowNodeId: string, processDefinition: IProcessDefEntity): IFlowDefEntity[] {
        const result: IFlowDefEntity[] = [];

        processDefinition.flowDefCollection.data.forEach((sequenceFlow) => {
            if (sequenceFlow.target.id === flowNodeId) {
                result.push(sequenceFlow);
            }
        });

        return result;
    }

    protected getOutgoingSequenceFlowsFor(flowNodeId: string, processDefinition: IProcessDefEntity): IFlowDefEntity[] {
        const result: IFlowDefEntity[] = [];

        processDefinition.flowDefCollection.data.forEach((sequenceFlow) => {
            if (sequenceFlow.source.id === flowNodeId) {
                result.push(sequenceFlow);
            }
        });

        return result;
    }
}