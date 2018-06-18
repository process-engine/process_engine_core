import { IExecutionContextFacade, IFlowNodeHandlerFactory,
  IProcessModelFacade, IProcessTokenFacade, Model, NextFlowNodeInfo, Runtime } from '@process-engine/process_engine_contracts';
import { FlowNodeHandler } from './index';

export class IntermediateThrowEventHandler extends FlowNodeHandler<Model.Events.Event> {
  protected async executeInternally(flowNode: Model.Events.Event,
                                    token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    executionContextFacade: IExecutionContextFacade): Promise<NextFlowNodeInfo> {

    const nextFlowNode: Model.Base.FlowNode = processModelFacade.getNextFlowNodeFor(flowNode);

    return new NextFlowNodeInfo(nextFlowNode, token, processTokenFacade);
  }
}
