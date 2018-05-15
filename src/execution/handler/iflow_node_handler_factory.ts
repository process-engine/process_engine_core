import { IFlowNodeHandler } from "./iflow_node_handler";
import { Model, BpmnType } from "@process-engine/process_engine_contracts";

export interface IFlowNodeHandlerFactory {
    create<TFlowNode extends Model.Base.FlowNode>(flowNode: TFlowNode): Promise<IFlowNodeHandler<TFlowNode>>;
}