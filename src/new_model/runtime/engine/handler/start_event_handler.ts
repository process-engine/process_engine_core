import { IExecutionContextFacade, IProcessModelFacade, IProcessTokenFacade, Model, NextFlowNodeInfo,
  Runtime } from '@process-engine/process_engine_contracts';
import { FlowNodeHandler } from './index';

export class StartEventHandler extends FlowNodeHandler<Model.Events.StartEvent> {

  protected async executeIntern(flowNode: Model.Events.StartEvent,
                                processTokenFacade: IProcessTokenFacade,
                                processModelFacade: IProcessModelFacade,
                                executionContextFacade: IExecutionContextFacade): Promise<NextFlowNodeInfo> {
    const nextFlowNode: Model.Base.FlowNode = await processModelFacade.getNextFlowNodeFor(flowNode);

    return new NextFlowNodeInfo(nextFlowNode, processTokenFacade);
  }
}
