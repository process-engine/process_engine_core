import { IFlowNodeHandler } from "./iflow_node_handler";
import { BpmnType } from "@process-engine/process_engine_contracts";

export interface IFlowNodeHandlerFactory {
    create(flowNodeTypeName: BpmnType): Promise<IFlowNodeHandler>;
}