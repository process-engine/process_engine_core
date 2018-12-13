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

import {FlowNodeHandlerInterruptable} from '../index';
export class ErrorBoundaryEventHandler extends FlowNodeHandlerInterruptable<Model.Events.BoundaryEvent> {

  private _decoratedHandler: FlowNodeHandlerInterruptable<Model.Base.FlowNode>;

  constructor(flowNodeInstanceService: IFlowNodeInstanceService,
              loggingApiService: ILoggingApi,
              metricsService: IMetricsApi,
              decoratedHandler: FlowNodeHandlerInterruptable<Model.Base.FlowNode>,
              errorBoundaryEventModel: Model.Events.BoundaryEvent) {
    super(flowNodeInstanceService, loggingApiService, metricsService, errorBoundaryEventModel);
    this._decoratedHandler = decoratedHandler;
  }

  public async interrupt(token: Runtime.Types.ProcessToken, terminate?: boolean): Promise<void> {
    this._decoratedHandler.interrupt(token, terminate);
  }

  protected async executeInternally(token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    identity: IIdentity): Promise<NextFlowNodeInfo> {
    try {
      // Must use return await here to prevent unhandled rejections.
      return await this._decoratedHandler.execute(token, processTokenFacade, processModelFacade, identity, this.previousFlowNodeInstanceId);
    } catch (err) {
      return this.getNextFlowNodeInfo(token, processTokenFacade, processModelFacade);
    }
  }

  protected async resumeInternally(flowNodeInstance: Runtime.Types.FlowNodeInstance,
                                   processTokenFacade: IProcessTokenFacade,
                                   processModelFacade: IProcessModelFacade,
                                   identity: IIdentity,
                                  ): Promise<NextFlowNodeInfo> {

    try {
      // Must use return await here to prevent unhandled rejections.
      return await this._decoratedHandler.resume(flowNodeInstance, processTokenFacade, processModelFacade, identity);
    } catch (err) {
      const onEnterToken: Runtime.Types.ProcessToken = flowNodeInstance.getTokenByType(Runtime.Types.ProcessTokenType.onEnter);

      return this.getNextFlowNodeInfo(onEnterToken, processTokenFacade, processModelFacade);
    }
  }
}
