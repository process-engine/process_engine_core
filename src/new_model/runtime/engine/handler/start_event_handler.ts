import {
  IExecutionContextFacade,
  IFlowNodeInstancePersistenceService,
  IProcessModelFacade,
  IProcessTokenFacade,
  Model,
  NextFlowNodeInfo,
  Runtime,
} from '@process-engine/process_engine_contracts';

import {FlowNodeHandler} from './index';

export class StartEventHandler extends FlowNodeHandler<Model.Events.StartEvent> {

  private _flowNodeInstancePersistenceService: IFlowNodeInstancePersistenceService = undefined;

  constructor(flowNodeInstancePersistenceService: IFlowNodeInstancePersistenceService) {
    super();
    this._flowNodeInstancePersistenceService = flowNodeInstancePersistenceService;
  }

  private get flowNodeInstancePersistenceService(): IFlowNodeInstancePersistenceService {
    return this._flowNodeInstancePersistenceService;
  }

  protected async executeInternally(flowNode: Model.Events.StartEvent,
                                    token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    executionContextFacade: IExecutionContextFacade): Promise<NextFlowNodeInfo> {

    const flowNodeInstanceId: string = super.createFlowNodeInstanceId();

    await this.flowNodeInstancePersistenceService.persistOnEnter(executionContextFacade, token, flowNode.id, flowNodeInstanceId);

    const nextFlowNode: Model.Base.FlowNode = await processModelFacade.getNextFlowNodeFor(flowNode);

    await this.flowNodeInstancePersistenceService.persistOnExit(executionContextFacade, token, flowNode.id, flowNodeInstanceId);

    return new NextFlowNodeInfo(nextFlowNode, token, processTokenFacade);
  }
}
