import { INodeDefEntity } from "@process-engine/process_engine_contracts";

export class NextFlowNodeInfo {
    public flowNode: INodeDefEntity;
    public shouldCreateNewToken: boolean;
}