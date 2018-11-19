import {IContainer} from 'addict-ioc';

import {InternalServerError} from '@essential-projects/errors_ts';
import {IIdentity} from '@essential-projects/iam_contracts';

import {ILoggingApi} from '@process-engine/logging_api_contracts';
import {IMetricsApi} from '@process-engine/metrics_api_contracts';
import {
  IFlowNodeInstanceService,
  IProcessModelFacade,
  IProcessTokenFacade,
  Model,
  NextFlowNodeInfo,
  Runtime,
} from '@process-engine/process_engine_contracts';

import {FlowNodeHandler} from './index';

export class IntermediateCatchEventHandler extends FlowNodeHandler<Model.Events.IntermediateCatchEvent> {

  private _childHandler: FlowNodeHandler<Model.Events.IntermediateCatchEvent>;
  private _container: IContainer = undefined;

  constructor(container: IContainer,
              flowNodeInstanceService: IFlowNodeInstanceService,
              loggingApiService: ILoggingApi,
              metricsService: IMetricsApi,
              intermediateCatchEventModel: Model.Events.IntermediateThrowEvent) {
    super(flowNodeInstanceService, loggingApiService, metricsService, intermediateCatchEventModel);
    this._container = container;
    this._childHandler = this._getChildEventHandler();
  }

  public getInstanceId(): string {
    return this._childHandler.getInstanceId();
  }

  private _getChildEventHandler(): FlowNodeHandler<Model.Events.IntermediateCatchEvent> {

    if (this.flowNode.messageEventDefinition) {
      return this._container.resolve<FlowNodeHandler<Model.Events.IntermediateCatchEvent>>('IntermediateMessageCatchEventHandler', [this.flowNode]);
    }

    if (this.flowNode.signalEventDefinition) {
      return this._container.resolve<FlowNodeHandler<Model.Events.IntermediateCatchEvent>>('IntermediateSignalCatchEventHandler', [this.flowNode]);
    }

    if (this.flowNode.timerEventDefinition) {
      return this._container.resolve<FlowNodeHandler<Model.Events.IntermediateCatchEvent>>('IntermediateTimerCatchEventHandler', [this.flowNode]);
    }

    await this.persistOnEnter(token);

    return this._persistAndContinue(token, processTokenFacade, processModelFacade);
  }

  public async resumeInternally(flowNodeInstance: Runtime.Types.FlowNodeInstance,
                                processTokenFacade: IProcessTokenFacade,
                                processModelFacade: IProcessModelFacade,
                                identity: IIdentity,
                              ): Promise<NextFlowNodeInfo> {

    if (this.flowNode.messageEventDefinition) {
      return this._resumeIntermediateCatchEventByType('IntermediateMessageCatchEventHandler',
                                                      flowNodeInstance,
                                                      processTokenFacade,
                                                      processModelFacade,
                                                      identity);
    }

    if (this.flowNode.signalEventDefinition) {
      return this._resumeIntermediateCatchEventByType('IntermediateSignalCatchEventHandler',
                                                      flowNodeInstance,
                                                      processTokenFacade,
                                                      processModelFacade,
                                                      identity);
    }

    if (this.flowNode.timerEventDefinition) {
      return this._resumeIntermediateCatchEventByType('IntermediateTimerCatchEventHandler',
                                                      flowNodeInstance,
                                                      processTokenFacade,
                                                      processModelFacade,
                                                      identity);
    }

    // The base handlers for IntermediateEvents only produce two tokens during their lifetime.
    // Therefore, we can safely assume that token list will only contain one entry at this point.
    const onEnterToken: Runtime.Types.ProcessToken = flowNodeInstance.tokens[0];

    return this._persistAndContinue(onEnterToken, processTokenFacade, processModelFacade);
  }

  private async _executeIntermediateCatchEventByType(eventHandlerName: string,
                                                     token: Runtime.Types.ProcessToken,
                                                     processTokenFacade: IProcessTokenFacade,
                                                     processModelFacade: IProcessModelFacade,
                                                     identity: IIdentity): Promise<NextFlowNodeInfo> {

    const eventHandler: FlowNodeHandler<Model.Events.IntermediateCatchEvent> =
      await this._container.resolveAsync<FlowNodeHandler<Model.Events.IntermediateCatchEvent>>(eventHandlerName, [this.flowNode]);

    return eventHandler.execute(token, processTokenFacade, processModelFacade, identity, this.previousFlowNodeInstanceId);
  }

  private async _resumeIntermediateCatchEventByType(eventHandlerName: string,
                                                    flowNodeInstance: Runtime.Types.FlowNodeInstance,
                                                    processTokenFacade: IProcessTokenFacade,
                                                    processModelFacade: IProcessModelFacade,
                                                    identity: IIdentity): Promise<NextFlowNodeInfo> {

    const eventHandler: FlowNodeHandler<Model.Events.IntermediateCatchEvent> =
      await this.container.resolveAsync<FlowNodeHandler<Model.Events.IntermediateCatchEvent>>(eventHandlerName, [this.flowNode]);

    return eventHandler.resume(flowNodeInstance, processTokenFacade, processModelFacade, identity);
  }

  private async _persistAndContinue(token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade): Promise<NextFlowNodeInfo> {

    const nextFlowNodeInfo: Model.Base.FlowNode = processModelFacade.getNextFlowNodeFor(this.flowNode);

    await this.persistOnExit(token);

    return new NextFlowNodeInfo(nextFlowNodeInfo, token, processTokenFacade);
  }
}
