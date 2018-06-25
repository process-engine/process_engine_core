import {
  IExecutionContextFacade,
  IFlowNodeInstancePersistence,
  IProcessModelFacade,
  IProcessTokenFacade,
  Model,
  NextFlowNodeInfo,
  Runtime,
} from '@process-engine/process_engine_contracts';

import {FlowNodeHandler} from './index';

export class EndEventHandler extends FlowNodeHandler<Model.Events.EndEvent> {

  private _flowNodeInstancePersistence: IFlowNodeInstancePersistence = undefined;

  constructor(flowNodeInstancePersistence: IFlowNodeInstancePersistence) {
    super();
    this._flowNodeInstancePersistence = flowNodeInstancePersistence;
  }

  private get flowNodeInstancePersistence(): IFlowNodeInstancePersistence {
    return this._flowNodeInstancePersistence;
  }

  protected async executeInternally(flowNode: Model.Events.EndEvent,
                                    token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    executionContextFacade: IExecutionContextFacade): Promise<NextFlowNodeInfo> {

    const flowNodeInstanceId: string = super.createFlowNodeInstanceId();

    await this.flowNodeInstancePersistence.persistOnEnter(token, flowNode.id, flowNodeInstanceId);
    await this.flowNodeInstancePersistence.persistOnExit(token, flowNode.id, flowNodeInstanceId);

    return new NextFlowNodeInfo(undefined, token, processTokenFacade);
  }
}
