import { IExecutionContextFascade, IFlowNodeHandlerFactory,
  IProcessModelFascade, IProcessTokenFascade, Model, Runtime} from '@process-engine/process_engine_contracts';
import {
  NextFlowNodeInfo,
} from './../../index';
import { FlowNodeHandler } from './index';

export class EndEventHandler extends FlowNodeHandler<Model.Events.EndEvent> {

  protected async executeIntern(flowNode: Model.Events.EndEvent,
                                processTokenFascade: IProcessTokenFascade,
                                processModelFascade: IProcessModelFascade,
                                executionContextFascade: IExecutionContextFascade): Promise<NextFlowNodeInfo> {
    return new NextFlowNodeInfo(null, processTokenFascade);
  }
}
