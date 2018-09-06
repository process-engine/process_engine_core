import {IMetricsService} from '@process-engine/metrics_api_contracts';
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

  constructor(container: IContainer, flowNodeInstanceService: IFlowNodeInstanceService, metricsService: IMetricsService) {
    super(flowNodeInstanceService, metricsService);
    this._container = container;
  }

  private get container(): IContainer {
    return this._container;
  }

  protected async executeInternally(flowNode: Model.Events.IntermediateCatchEvent,
                                    token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    executionContextFacade: IExecutionContextFacade): Promise<NextFlowNodeInfo> {

    if (flowNode.messageEventDefinition) {
      return this._executeIntermediateCatchEventByType('IntermediateMessageCatchEventHandler',
                                                       flowNode,
                                                       token,
                                                       processTokenFacade,
                                                       processModelFacade,
                                                       executionContextFacade);
    }

    if (flowNode.signalEventDefinition) {
      return this._executeIntermediateCatchEventByType('IntermediateSignalCatchEventHandler',
                                                       flowNode,
                                                       token,
                                                       processTokenFacade,
                                                       processModelFacade,
                                                       executionContextFacade);
    }

    if (flowNode.timerEventDefinition) {
      return this._executeIntermediateCatchEventByType('IntermediateTimerCatchEventHandler',
                                                       flowNode,
                                                       token,
                                                       processTokenFacade,
                                                       processModelFacade,
                                                       executionContextFacade);
    }

    // TODO: Default behavior, in case an unsupported intermediate event is used.
    // Can probably be removed, once we support Signals.
    // Note that FlowNodeInstance persistence is usually delegated to the dedicated event handlers
    // ('IntermediateMessageCatchEventHandler', etc). Since this use case addresses events that are not yet supported,
    // this method must handle state persistence by itself.
    return this._persistAndContinue(flowNode, token, processTokenFacade, processModelFacade, executionContextFacade);
  }

  private async _executeIntermediateCatchEventByType(eventHandlerName: string,
                                                     flowNode: Model.Events.IntermediateCatchEvent,
                                                     token: Runtime.Types.ProcessToken,
                                                     processTokenFacade: IProcessTokenFacade,
                                                     processModelFacade: IProcessModelFacade,
                                                     executionContextFacade: IExecutionContextFacade): Promise<NextFlowNodeInfo> {

    const eventHandler: FlowNodeHandler<Model.Events.IntermediateCatchEvent> =
      await this.container.resolveAsync<FlowNodeHandler<Model.Events.IntermediateCatchEvent>>(eventHandlerName);

    return eventHandler.execute(flowNode, token, processTokenFacade, processModelFacade, executionContextFacade);
  }

  private async _persistAndContinue(flowNode: Model.Events.IntermediateCatchEvent,
                                    token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    executionContextFacade: IExecutionContextFacade): Promise<NextFlowNodeInfo> {

    await this.persistOnEnter(flowNode, token);

    const nextFlowNodeInfo: Model.Base.FlowNode = processModelFacade.getNextFlowNodeFor(flowNode);

    await this.persistOnExit(flowNode, token);

    return new NextFlowNodeInfo(nextFlowNodeInfo, token, processTokenFacade);
  }
}
