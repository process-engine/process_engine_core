import {IContainer} from 'addict-ioc';

import {UnprocessableEntityError} from '@essential-projects/errors_ts';
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

import {FlowNodeHandlerInterruptable} from './index';

export class ParallelGatewayHandler extends FlowNodeHandlerInterruptable<Model.Gateways.ParallelGateway> {

  private _childHandler: FlowNodeHandlerInterruptable<Model.Gateways.ParallelGateway>;
  private _container: IContainer = undefined;

  constructor(container: IContainer,
              flowNodeInstanceService: IFlowNodeInstanceService,
              loggingApiService: ILoggingApi,
              metricsService: IMetricsApi,
              serviceTaskModel: Model.Gateways.ParallelGateway) {

    super(flowNodeInstanceService, loggingApiService, metricsService, serviceTaskModel);
    this._container = container;
    this._childHandler = this._getChildHandler();
  }

  public getInstanceId(): string {
    return this._childHandler.getInstanceId();
  }

  public async interrupt(token: Runtime.Types.ProcessToken, terminate?: boolean): Promise<void> {
    return this._childHandler.interrupt(token, terminate);
  }

  private _getChildHandler(): FlowNodeHandlerInterruptable<Model.Gateways.ParallelGateway> {

    switch (this.flowNode.gatewayDirection) {
      case Model.Gateways.GatewayDirection.Converging:
        return this._container.resolve<FlowNodeHandlerInterruptable<Model.Gateways.ParallelGateway>>('ParallelJoinGatewayHandler', [this.flowNode]);
      case Model.Gateways.GatewayDirection.Diverging:
        return this._container.resolve<FlowNodeHandlerInterruptable<Model.Gateways.ParallelGateway>>('ParallelSplitGatewayHandler', [this.flowNode]);
      default:
        const unsupportedErrorMessage: string =
          `ParallelGateway ${this.flowNode.id} is neither a Split- nor a Join-Gateway! Mixed Gateways are NOT supported!`;
        throw new UnprocessableEntityError(unsupportedErrorMessage);
    }
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
