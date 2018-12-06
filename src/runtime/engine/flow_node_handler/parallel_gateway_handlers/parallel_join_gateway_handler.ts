import {Logger} from 'loggerhythm';

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

import {FlowNodeHandler} from '../index';

export class ParallelJoinGatewayHandler extends FlowNodeHandler<Model.Gateways.ParallelGateway> {

  constructor(flowNodeInstanceService: IFlowNodeInstanceService,
              loggingApiService: ILoggingApi,
              metricsService: IMetricsApi,
              parallelGatewayModel: Model.Gateways.ParallelGateway) {
    super(flowNodeInstanceService, loggingApiService, metricsService, parallelGatewayModel);
    this.logger = Logger.createLogger(`processengine:parallel_join_gateway:${parallelGatewayModel.id}`);
  }

  protected async executeInternally(token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    identity: IIdentity): Promise<NextFlowNodeInfo> {

    this.logger.verbose(`Executing ParallelJoinGateway instance ${this.flowNodeInstanceId}.`);
    await this.persistOnEnter(token);

    return await this._executeHandler(token, processTokenFacade, processModelFacade, identity);
  }

  protected async _executeHandler(token: Runtime.Types.ProcessToken,
                                  processTokenFacade: IProcessTokenFacade,
                                  processModelFacade: IProcessModelFacade,
                                  identity: IIdentity): Promise<NextFlowNodeInfo> {
    await this.persistOnExit(token);

    return this.getNextFlowNodeInfo(token, processTokenFacade, processModelFacade);
  }
}
