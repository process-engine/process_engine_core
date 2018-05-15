import { IFlowNodeHandler } from "./iflow_node_handler";
import { Model, BpmnType } from "@process-engine/process_engine_contracts";

export interface IFlowNodeHandlerFactory {
    create(flowNodeTypeName: BpmnType): Promise<IFlowNodeHandler<Model.Base.FlowNode>>;
}