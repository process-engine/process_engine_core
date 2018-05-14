import { FlowNodeHandler } from "./flow_node_handler";
import { Model, Runtime } from '@process-engine/process_engine_contracts';
import { NextFlowNodeInfo } from "..";
import { ExecutionContext } from "@essential-projects/core_contracts";

export class EndEventHandler extends FlowNodeHandler {

    protected async executeIntern(flowNode: Model.Base.FlowNode, processToken: Runtime.Types.ProcessToken, context: ExecutionContext): Promise<NextFlowNodeInfo> {
        return new NextFlowNodeInfo(null, processToken);
    }
}