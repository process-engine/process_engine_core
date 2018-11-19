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

    if (this.flowNode.messageEventDefinition) {
      return this._container.resolve<FlowNodeHandler<Model.Events.IntermediateCatchEvent>>('IntermediateMessageThrowEventHandler', [this.flowNode]);
    }

    if (this.flowNode.signalEventDefinition) {
      return this._container.resolve<FlowNodeHandler<Model.Events.IntermediateCatchEvent>>('IntermediateSignalThrowEventHandler', [this.flowNode]);
    }

    return this._persistAndContinue(token, processTokenFacade, processModelFacade, identity);
  }

  public async resumeInternally(flowNodeInstance: Runtime.Types.FlowNodeInstance,
                                processTokenFacade: IProcessTokenFacade,
                                processModelFacade: IProcessModelFacade,
                                identity: IIdentity,
                              ): Promise<NextFlowNodeInfo> {

    throw new Error('Not implemented yet.');
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

  protected async executeInternally(token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    identity: IIdentity): Promise<NextFlowNodeInfo> {

    return this._childHandler.execute(token, processTokenFacade, processModelFacade, identity, this.previousFlowNodeInstanceId);
  }
}
