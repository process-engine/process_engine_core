import {
  IExecutionContextFacade,
  IFlowNodeInstanceService,
  IProcessModelFacade,
  IProcessTokenFacade,
  Model,
  NextFlowNodeInfo,
  Runtime,
} from '@process-engine/process_engine_contracts';

import {FlowNodeHandler} from './index';

import {IContainer} from 'addict-ioc';

export class IntermediateCatchEventHandler extends FlowNodeHandler<Model.Events.IntermediateCatchEvent> {

  private _container: IContainer = undefined;

  constructor(container: IContainer) {
    super();
    this._container = container;
  }

  private get container(): IContainer {
    return this._container;
  }

  protected async executeInternally(flowNodeInfo: NextFlowNodeInfo<Model.Events.IntermediateCatchEvent>,
                                    token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    executionContextFacade: IExecutionContextFacade): Promise<NextFlowNodeInfo<any>> {

    if (flowNodeInfo.flowNode.messageEventDefinition) {
      return this._executeIntermediateCatchEventByType('IntermediateMessageCatchEventHandler',
                                                       flowNodeInfo,
                                                       token,
                                                       processTokenFacade,
                                                       processModelFacade,
                                                       executionContextFacade);
    }

    // TODO: Default behavior, in case an unsupported intermediate event is used.
    // Can probably be removed, once we support Signals and Timers.
    // Note that FlowNodeInstance persistence is usually delegated to the dedicated event handlers
    // ('IntermediateMessageCatchEventHandler', etc). Since this use case addresses events that are not yet supported,
    // this method must handle state persistence by itself.
    return this._persistAndContinue(flowNodeInfo, token, processTokenFacade, processModelFacade, executionContextFacade);
  }

  private async _executeIntermediateCatchEventByType(eventHandlerName: string,
                                                     flowNodeInfo: NextFlowNodeInfo<Model.Events.IntermediateCatchEvent>,
                                                     token: Runtime.Types.ProcessToken,
                                                     processTokenFacade: IProcessTokenFacade,
                                                     processModelFacade: IProcessModelFacade,
                                                     executionContextFacade: IExecutionContextFacade): Promise<NextFlowNodeInfo<any>> {

    const eventHandler: FlowNodeHandler<Model.Events.IntermediateCatchEvent> =
      await this.container.resolveAsync<FlowNodeHandler<Model.Events.IntermediateCatchEvent>>(eventHandlerName);

    return eventHandler.execute(flowNodeInfo, token, processTokenFacade, processModelFacade, executionContextFacade);
  }

  private async _persistAndContinue(flowNodeInfo: NextFlowNodeInfo<Model.Events.IntermediateCatchEvent>,
                                    token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    executionContextFacade: IExecutionContextFacade): Promise<NextFlowNodeInfo<any>> {

    const flowNode: Model.Events.IntermediateCatchEvent = flowNodeInfo.flowNode;

    const flowNodeInstanceService: IFlowNodeInstanceService = await this.container.resolveAsync<IFlowNodeInstanceService>('FlowNodeInstanceService');

    const flowNodeInstanceId: string = super.createFlowNodeInstanceId();

    await flowNodeInstanceService.persistOnEnter(executionContextFacade, token, flowNode.id, flowNodeInstanceId);

    const nextFlowNodeInfo: Model.Base.FlowNode = processModelFacade.getNextFlowNodeFor(flowNode);

    await flowNodeInstanceService.persistOnExit(executionContextFacade, token, flowNode.id, flowNodeInstanceId);

    return new NextFlowNodeInfo(nextFlowNodeInfo, token, processTokenFacade);
  }
}
