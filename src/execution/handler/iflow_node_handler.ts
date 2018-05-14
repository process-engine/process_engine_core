import { INodeDefEntity, IProcessTokenEntity } from "@process-engine/process_engine_contracts";
import { ExecutionContext } from "@essential-projects/core_contracts";
import { NextFlowNodeInfo } from "../next_flow_node_info";
import { Model, Runtime } from '@process-engine/process_engine_contracts';
import {IProcessModelFascade} from './../index';

export interface IFlowNodeHandler {
    execute(flowNode: Model.Base.FlowNode, processToken: Runtime.Types.ProcessToken, processModelFascade: IProcessModelFascade, context: ExecutionContext): Promise<NextFlowNodeInfo>;
}