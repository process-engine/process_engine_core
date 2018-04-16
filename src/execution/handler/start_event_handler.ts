import { FlowNodeHandler } from "./flow_node_handler";
import { INodeDefEntity, IProcessTokenEntity } from "@process-engine/process_engine_contracts";
import { NextFlowNodeInfo } from "..";
import { ExecutionContext } from "@essential-projects/core_contracts";

export class StartEventHandler extends FlowNodeHandler {
    
    protected async executeIntern(flowNode: INodeDefEntity, processToken: IProcessTokenEntity, context: ExecutionContext): Promise<void> {
        
    }
}