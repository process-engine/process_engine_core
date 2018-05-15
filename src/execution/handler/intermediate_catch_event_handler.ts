import {FlowNodeHandler} from './flow_node_handler'
import { INodeDefEntity, IProcessTokenEntity } from '@process-engine/process_engine_contracts';
import { ExecutionContext } from '@essential-projects/core_contracts';
import { NextFlowNodeInfo } from '../next_flow_node_info';
import { Model, Runtime } from '@process-engine/process_engine_contracts';
import { IProcessModelFascade, IProcessTokenFascade } from '../index';

export class IntermedtiateCatchEventHandler extends FlowNodeHandler<Model.Events.Event> {
    protected async executeIntern(flowNode: Model.Events.Event, processTokenFascade: IProcessTokenFascade, processModelFascade: IProcessModelFascade): Promise<NextFlowNodeInfo> {
        await new Promise<void>( resolve => setTimeout(resolve, 2000) );

        const nextFlowNode: Model.Base.FlowNode = processModelFascade.getNextFlowNodeFor(flowNode);
        return new NextFlowNodeInfo(nextFlowNode, processTokenFascade);
    }
}