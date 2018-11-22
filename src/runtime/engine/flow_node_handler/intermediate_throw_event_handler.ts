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

export class IntermediateThrowEventHandler extends FlowNodeHandler<Model.Events.IntermediateThrowEvent> {

  private _childHandler: FlowNodeHandler<Model.Events.IntermediateCatchEvent>;
  private _container: IContainer = undefined;

  constructor(container: IContainer,
              flowNodeInstanceService: IFlowNodeInstanceService,
              loggingApiService: ILoggingApi,
              metricsService: IMetricsApi,
              intermediateThrowEventModel: Model.Events.IntermediateThrowEvent) {
    super(flowNodeInstanceService, loggingApiService, metricsService, intermediateThrowEventModel);
    this._container = container;
    this._childHandler = this._getChildHandler();
  }

  public getInstanceId(): string {
    return this._childHandler.getInstanceId();
  }

  private _getChildHandler(): FlowNodeHandler<Model.Events.IntermediateCatchEvent> {

    await this.persistOnEnter(token);

    if (this.flowNode.messageEventDefinition) {
      return this._container.resolve<FlowNodeHandler<Model.Events.IntermediateCatchEvent>>('IntermediateMessageThrowEventHandler', [this.flowNode]);
    }

    if (this.flowNode.signalEventDefinition) {
      return this._container.resolve<FlowNodeHandler<Model.Events.IntermediateCatchEvent>>('IntermediateSignalThrowEventHandler', [this.flowNode]);
    }

    return this._persistAndContinue(token, processTokenFacade, processModelFacade, identity);
  }

  protected async resumeInternally(flowNodeInstance: Runtime.Types.FlowNodeInstance,
                                   processTokenFacade: IProcessTokenFacade,
                                   processModelFacade: IProcessModelFacade,
                                   identity: IIdentity,
                                  ): Promise<NextFlowNodeInfo> {

    if (this.flowNode.messageEventDefinition) {
      return this._resumeIntermediateThrowEventByType('IntermediateMessageThrowEventHandler',
                                                      flowNodeInstance,
                                                      processTokenFacade,
                                                      processModelFacade,
                                                     identity);
    }

    if (this.flowNode.signalEventDefinition) {
      return this._resumeIntermediateThrowEventByType('IntermediateSignalThrowEventHandler',
                                                      flowNodeInstance,
                                                      processTokenFacade,
                                                      processModelFacade,
                                                      identity);
    }

    // The base handlers for IntermediateEvents only produce two tokens during their lifetime.
    // Therefore, we can safely assume that token list will only contain one entry at this point.
    const onEnterToken: Runtime.Types.ProcessToken = flowNodeInstance.tokens[0];

    return this._persistAndContinue(onEnterToken, processTokenFacade, processModelFacade, identity);
  }

  private async _executeIntermediateThrowEventByType(eventHandlerName: string,
                                                     token: Runtime.Types.ProcessToken,
                                                     processTokenFacade: IProcessTokenFacade,
                                                     processModelFacade: IProcessModelFacade,
                                                     identity: IIdentity): Promise<NextFlowNodeInfo> {

    const eventHandler: FlowNodeHandler<Model.Events.IntermediateThrowEvent> =
      await this._container.resolveAsync<FlowNodeHandler<Model.Events.IntermediateThrowEvent>>(eventHandlerName, [this.flowNode]);

    return eventHandler.execute(token, processTokenFacade, processModelFacade, identity, this.previousFlowNodeInstanceId);
  }

  private async _resumeIntermediateThrowEventByType(eventHandlerName: string,
                                                    flowNodeInstance: Runtime.Types.FlowNodeInstance,
                                                    processTokenFacade: IProcessTokenFacade,
                                                    processModelFacade: IProcessModelFacade,
                                                    identity: IIdentity): Promise<NextFlowNodeInfo> {

    const eventHandler: FlowNodeHandler<Model.Events.IntermediateCatchEvent> =
      await this._container.resolveAsync<FlowNodeHandler<Model.Events.IntermediateCatchEvent>>(eventHandlerName, [this.flowNode]);

    return eventHandler.resume(flowNodeInstance, processTokenFacade, processModelFacade, identity);
  }

  private async _persistAndContinue(token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    identity: IIdentity): Promise<NextFlowNodeInfo> {

    const nextFlowNodeInfo: Model.Base.FlowNode = processModelFacade.getNextFlowNodeFor(this.flowNode);

    await this.persistOnExit(token);

    return new NextFlowNodeInfo(nextFlowNodeInfo, token, processTokenFacade);
  }
}
