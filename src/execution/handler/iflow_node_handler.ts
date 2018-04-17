import { INodeDefEntity, IProcessTokenEntity } from "@process-engine/process_engine_contracts";
import { ExecutionContext } from "@essential-projects/core_contracts";
import { NextFlowNodeInfo } from "../next_flow_node_info";

export interface IFlowNodeHandler {
    execute(flowNode: INodeDefEntity, processToken: IProcessTokenEntity, context: ExecutionContext): Promise<NextFlowNodeInfo>;
}