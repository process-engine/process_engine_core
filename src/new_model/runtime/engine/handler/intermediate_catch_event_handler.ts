import { IExecutionContextFacade, IProcessModelFacade, IProcessTokenFacade,
  Model, NextFlowNodeInfo, Runtime } from '@process-engine/process_engine_contracts';
import { FlowNodeHandler } from './index';

export class IntermediateCatchEventHandler extends FlowNodeHandler<Model.Events.Event> {
  protected async executeIntern(flowNode: Model.Events.Event,
                                processTokenFacade: IProcessTokenFacade,
                                processModelFacade: IProcessModelFacade,
                                executionContextFacade: IExecutionContextFacade): Promise<NextFlowNodeInfo> {

    const nextFlowNode: Model.Base.FlowNode = processModelFacade.getNextFlowNodeFor(flowNode);

    return new NextFlowNodeInfo(nextFlowNode, processTokenFacade);
  }
}
