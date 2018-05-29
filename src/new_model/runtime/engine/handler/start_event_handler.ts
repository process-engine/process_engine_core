import { IExecutionContextFascade, IProcessModelFascade, IProcessTokenFascade, Model, NextFlowNodeInfo,
  Runtime } from '@process-engine/process_engine_contracts';
import { FlowNodeHandler } from './index';

export class StartEventHandler extends FlowNodeHandler<Model.Events.StartEvent> {

  protected async executeIntern(flowNode: Model.Events.StartEvent,
                                processTokenFascade: IProcessTokenFascade,
                                processModelFascade: IProcessModelFascade,
                                executionContextFascade: IExecutionContextFascade): Promise<NextFlowNodeInfo> {
    const nextFlowNode: Model.Base.FlowNode = await processModelFascade.getNextFlowNodeFor(flowNode);

    return new NextFlowNodeInfo(nextFlowNode, processTokenFascade);
  }
}
