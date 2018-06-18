import { IExecutionContextFacade, IProcessModelFacade, IProcessTokenFacade, Model, NextFlowNodeInfo,
  Runtime } from '@process-engine/process_engine_contracts';
import { FlowNodeHandler } from './index';

export class StartEventHandler extends FlowNodeHandler<Model.Events.StartEvent> {

  protected async executeInternally(flowNode: Model.Events.StartEvent,
                                    token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    executionContextFacade: IExecutionContextFacade): Promise<NextFlowNodeInfo> {
    const nextFlowNode: Model.Base.FlowNode = await processModelFacade.getNextFlowNodeFor(flowNode);
    const newToken: Runtime.Types.ProcessToken = processTokenFacade.createProcessToken(token.payload);

    return new NextFlowNodeInfo(nextFlowNode, newToken, processTokenFacade);
  }
}