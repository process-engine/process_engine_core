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

export class IntermediateThrowEventHandler extends FlowNodeHandler<Model.Events.IntermediateThrowEvent> {

  private _container: IContainer = undefined;

  constructor(container: IContainer) {
    super();
    this._container = container;
  }

  private get container(): IContainer {
    return this._container;
  }

  protected async executeInternally(flowNode: Model.Events.IntermediateThrowEvent,
                                    token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    executionContextFacade: IExecutionContextFacade): Promise<NextFlowNodeInfo> {

    if (flowNode.messageEventDefinition) {
      return this._executeIntermediateThrowEventByType('IntermediateMessageThrowEventHandler',
                                                       flowNode,
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
    return this._persistAndContinue(flowNode, token, processTokenFacade, processModelFacade, executionContextFacade);
  }

  private async _executeIntermediateThrowEventByType(eventHandlerName: string,
                                                     flowNode: Model.Events.IntermediateThrowEvent,
                                                     token: Runtime.Types.ProcessToken,
                                                     processTokenFacade: IProcessTokenFacade,
                                                     processModelFacade: IProcessModelFacade,
                                                     executionContextFacade: IExecutionContextFacade): Promise<NextFlowNodeInfo> {

    const eventHandler: FlowNodeHandler<Model.Events.IntermediateThrowEvent> =
      await this.container.resolveAsync<FlowNodeHandler<Model.Events.IntermediateThrowEvent>>(eventHandlerName);

    return eventHandler.execute(flowNode, token, processTokenFacade, processModelFacade, executionContextFacade);
  }

  private async _persistAndContinue(flowNode: Model.Events.IntermediateThrowEvent,
                                    token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    executionContextFacade: IExecutionContextFacade): Promise<NextFlowNodeInfo> {

    const flowNodeInstanceService: IFlowNodeInstanceService = await this.container.resolveAsync<IFlowNodeInstanceService>('FlowNodeInstanceService');

    await flowNodeInstanceService.persistOnEnter(flowNode.id, this.flowNodeInstanceId, token);

    const nextFlowNodeInfo: Model.Base.FlowNode = processModelFacade.getNextFlowNodeFor(flowNode);

    await flowNodeInstanceService.persistOnExit(flowNode.id, this.flowNodeInstanceId, token);

    return new NextFlowNodeInfo(nextFlowNodeInfo, token, processTokenFacade);
  }
}
