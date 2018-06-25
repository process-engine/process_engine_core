import {
  IExecutionContextFacade,
  IFlowNodeInstancePersistance,
  IProcessModelFacade,
  IProcessTokenFacade,
  Model,
  NextFlowNodeInfo,
  Runtime,
} from '@process-engine/process_engine_contracts';

import {FlowNodeHandler} from './index';

export class IntermediateThrowEventHandler extends FlowNodeHandler<Model.Events.Event> {

  private _flowNodeInstancePersistance: IFlowNodeInstancePersistance = undefined;

  constructor(flowNodeInstancePersistance: IFlowNodeInstancePersistance) {
    super();
    this._flowNodeInstancePersistance = flowNodeInstancePersistance;
  }

  private get flowNodeInstancePersistance(): IFlowNodeInstancePersistance {
    return this._flowNodeInstancePersistance;
  }

  protected async executeInternally(flowNode: Model.Events.Event,
                                    token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    executionContextFacade: IExecutionContextFacade): Promise<NextFlowNodeInfo> {

    const flowNodeInstanceId: string = super.createFlowNodeInstanceId();

    await this.flowNodeInstancePersistance.persistOnEnter(token, flowNode.id, flowNodeInstanceId);

    const nextFlowNode: Model.Base.FlowNode = processModelFacade.getNextFlowNodeFor(flowNode);

    await this.flowNodeInstancePersistance.persistOnExit(token, flowNode.id, flowNodeInstanceId);

    return new NextFlowNodeInfo(nextFlowNode, token, processTokenFacade);
  }
}
