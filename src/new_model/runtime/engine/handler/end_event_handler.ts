import { IExecutionContextFacade, IFlowNodeHandlerFactory, IProcessModelFacade,
  IProcessTokenFacade, Model, NextFlowNodeInfo, Runtime} from '@process-engine/process_engine_contracts';
import { FlowNodeHandler } from './index';

export class EndEventHandler extends FlowNodeHandler<Model.Events.EndEvent> {

  protected async executeIntern(flowNode: Model.Events.EndEvent,
                                processTokenFacade: IProcessTokenFacade,
                                processModelFacade: IProcessModelFacade,
                                executionContextFacade: IExecutionContextFacade): Promise<NextFlowNodeInfo> {
    return new NextFlowNodeInfo(undefined, processTokenFacade);
  }
}
