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

import {FlowNodeHandlerInterruptible} from './index';

export class IntermediateCatchEventHandler extends FlowNodeHandlerInterruptible<Model.Events.IntermediateCatchEvent> {

  private _childHandler: FlowNodeHandlerInterruptible<Model.Events.IntermediateCatchEvent>;
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

  public async interrupt(token: Runtime.Types.ProcessToken, terminate?: boolean): Promise<void> {
    return this._childHandler.interrupt(token, terminate);
  }

  private _getChildEventHandler(): FlowNodeHandlerInterruptible<Model.Events.IntermediateCatchEvent> {

    if (this.flowNode.messageEventDefinition) {
      return this
        ._container
        .resolve<FlowNodeHandlerInterruptible<Model.Events.IntermediateCatchEvent>>('IntermediateMessageCatchEventHandler', [this.flowNode]);
    }

    if (this.flowNode.signalEventDefinition) {
      return this
        ._container
        .resolve<FlowNodeHandlerInterruptible<Model.Events.IntermediateCatchEvent>>('IntermediateSignalCatchEventHandler', [this.flowNode]);
    }

    if (this.flowNode.timerEventDefinition) {
      return this
        ._container
        .resolve<FlowNodeHandlerInterruptible<Model.Events.IntermediateCatchEvent>>('IntermediateTimerCatchEventHandler', [this.flowNode]);
    }

    throw new InternalServerError(`The IntermediateCatchEventType used with FlowNode ${this.flowNode.id} is not supported!`);
  }

  protected async executeInternally(token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    identity: IIdentity): Promise<NextFlowNodeInfo> {

    return this._childHandler.execute(token, processTokenFacade, processModelFacade, identity, this.previousFlowNodeInstanceId);
  }

  protected async resumeInternally(flowNodeInstance: Runtime.Types.FlowNodeInstance,
                                   processTokenFacade: IProcessTokenFacade,
                                   processModelFacade: IProcessModelFacade,
                                   identity: IIdentity): Promise<NextFlowNodeInfo> {

    return this._childHandler.resume(flowNodeInstance, processTokenFacade, processModelFacade, identity);
  }
}
