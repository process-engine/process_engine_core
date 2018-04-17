import {FlowNodeHandler} from './flow_node_handler'
import { INodeDefEntity, IProcessTokenEntity } from '@process-engine/process_engine_contracts';
import { ExecutionContext } from '@essential-projects/core_contracts';

export class IntermedtiateCatchEventHandler extends FlowNodeHandler {
    protected async executeIntern(flowNode: INodeDefEntity, processToken: IProcessTokenEntity, context: ExecutionContext): Promise<void> {
        return new Promise<void>( resolve => setTimeout(resolve, 2000) );
    }
}