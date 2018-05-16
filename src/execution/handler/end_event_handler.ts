import { Model, Runtime } from '@process-engine/process_engine_contracts';
import {
  IProcessModelFascade,
  IProcessTokenFascade,
  NextFlowNodeInfo,
} from './../../index';
import { IFlowNodeHandlerFactory } from './iflow_node_handler_factory';
import { FlowNodeHandler } from './index';

export class EndEventHandler extends FlowNodeHandler<Model.Events.EndEvent> {

    protected async executeIntern(flowNode: Model.Events.EndEvent, processTokenFascade: IProcessTokenFascade, processModelFascade: IProcessModelFascade): Promise<NextFlowNodeInfo> {
        return new NextFlowNodeInfo(null, processTokenFascade);
    }
}
