import { INodeDefEntity, IProcessTokenEntity } from "@process-engine/process_engine_contracts";
import { Model, Runtime } from "@process-engine/process_engine_contracts";

export class NextFlowNodeInfo {

    constructor(flowNode: Model.Base.FlowNode, processToken: Runtime.Types.ProcessToken) {
        this.flowNode = flowNode;
        this.processToken = processToken;
    }

    public flowNode: Model.Base.FlowNode;
    public processToken: Runtime.Types.ProcessToken;
}