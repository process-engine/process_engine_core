import { IExecutionContextFacade, IFlowNodeHandlerFactory, IProcessModelFacade,
  IProcessTokenFacade, Model, NextFlowNodeInfo, Runtime} from '@process-engine/process_engine_contracts';
import { FlowNodeHandler } from './index';

export class EndEventHandler extends FlowNodeHandler<Model.Events.EndEvent> {

  protected async executeInternally(flowNode: Model.Events.EndEvent,
                                    token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    executionContextFacade: IExecutionContextFacade): Promise<NextFlowNodeInfo> {
    return new NextFlowNodeInfo(undefined, processTokenFacade);
  }
}
