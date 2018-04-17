import { INodeDefEntity, IProcessTokenEntity } from "@process-engine/process_engine_contracts";

export class NextFlowNodeInfo {

    constructor(flowNode: INodeDefEntity, processToken: IProcessTokenEntity) {
        this.flowNode = flowNode;
        this.processToken = processToken;
    }

    public flowNode: INodeDefEntity;
    public processToken: IProcessTokenEntity;
}