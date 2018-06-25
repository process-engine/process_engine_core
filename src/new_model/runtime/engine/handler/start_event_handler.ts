import { IExecutionContextFacade, IProcessModelFacade, IProcessTokenFacade, Model, NextFlowNodeInfo, IFlowNodeInstancePersistence,
  Runtime } from '@process-engine/process_engine_contracts';
import { FlowNodeHandler } from './index';

export class StartEventHandler extends FlowNodeHandler<Model.Events.StartEvent> {

  private _flowNodeInstancePersistence: IFlowNodeInstancePersistence = undefined;

  constructor(flowNodeInstancePersistence: IFlowNodeInstancePersistence) {
    super();
    this._flowNodeInstancePersistence = flowNodeInstancePersistence;
  }

  private get flowNodeInstancePersistence(): IFlowNodeInstancePersistence {
    return this._flowNodeInstancePersistence;
  }

  protected async executeInternally(flowNode: Model.Events.StartEvent,
                                    token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    executionContextFacade: IExecutionContextFacade): Promise<NextFlowNodeInfo> { 

    const flowNodeInstanceId: string = super.createFlowNodeInstanceId();
    
    await this.flowNodeInstancePersistence.persistOnEnter(token, flowNode.id, flowNodeInstanceId);
    
    const nextFlowNode: Model.Base.FlowNode = await processModelFacade.getNextFlowNodeFor(flowNode);

    await this.flowNodeInstancePersistence.persistOnExit(token, flowNode.id, flowNodeInstanceId);

    return new NextFlowNodeInfo(nextFlowNode, token, processTokenFacade);
  }
}
