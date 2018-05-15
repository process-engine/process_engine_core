import { INodeDefEntity, IProcessTokenEntity, BpmnType } from "@process-engine/process_engine_contracts";
import { ExecutionContext } from "@essential-projects/core_contracts";
import { NextFlowNodeInfo } from "../next_flow_node_info";
import { Model, Runtime } from '@process-engine/process_engine_contracts';
import {IProcessModelFascade, IProcessTokenFascade} from './../index';

export interface IFlowNodeHandler<TFlowNode extends Model.Base.FlowNode> {
    execute(flowNode: TFlowNode, processTokenFascade: IProcessTokenFascade, processModelFascade: IProcessModelFascade): Promise<NextFlowNodeInfo>;
}