import {FlowNodeHandler} from './flow_node_handler'
import { INodeDefEntity, IProcessTokenEntity } from '@process-engine/process_engine_contracts';
import { ExecutionContext } from '@essential-projects/core_contracts';
import { NextFlowNodeInfo } from '../next_flow_node_info';

export class IntermedtiateThrowEventHandler extends FlowNodeHandler {
    protected async executeIntern(flowNode: INodeDefEntity, processToken: IProcessTokenEntity, context: ExecutionContext): Promise<NextFlowNodeInfo> {
        await new Promise<void>( resolve => setTimeout(resolve, 2000) );

        return new NextFlowNodeInfo(await this.getNextFlowNodeFor(flowNode, context), processToken);
    }
}