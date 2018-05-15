import { FlowNodeHandler } from "./flow_node_handler";
import { Model, Runtime } from '@process-engine/process_engine_contracts';
import { NextFlowNodeInfo } from "..";
import { ExecutionContext } from "@essential-projects/core_contracts";
import { IProcessModelFascade, IProcessTokenFascade } from '../index';

export class EndEventHandler extends FlowNodeHandler<Model.Events.EndEvent> {

    protected async executeIntern(flowNode: Model.Events.EndEvent, processTokenFascade: IProcessTokenFascade, processModelFascade: IProcessModelFascade): Promise<NextFlowNodeInfo> {
        return new NextFlowNodeInfo(null, processTokenFascade);
    }
}