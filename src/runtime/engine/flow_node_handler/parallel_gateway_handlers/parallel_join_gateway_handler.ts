import {Logger} from 'loggerhythm';

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

import {FlowNodeHandler} from '../index';

export class ParallelJoinGatewayHandler extends FlowNodeHandler<Model.Gateways.ParallelGateway> {

  private logger: Logger;

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

  protected async resumeInternally(flowNodeInstance: Runtime.Types.FlowNodeInstance,
                                   processTokenFacade: IProcessTokenFacade,
                                   processModelFacade: IProcessModelFacade,
                                   identity: IIdentity,
                                  ): Promise<NextFlowNodeInfo> {

    this.logger.verbose(`Resuming ParallelJoinGateway instance ${flowNodeInstance.id}.`);

    switch (flowNodeInstance.state) {
      case Runtime.Types.FlowNodeInstanceState.running:
        this.logger.verbose(`ParallelJoinGateway was unfinished. Resuming from the start.`);
        const onEnterToken: Runtime.Types.ProcessToken = flowNodeInstance.getTokenByType(Runtime.Types.ProcessTokenType.onEnter);

        return this._continueAfterEnter(onEnterToken, processTokenFacade, processModelFacade, identity);
      case Runtime.Types.FlowNodeInstanceState.finished:
        this.logger.verbose(`ParallelJoinGateway was already finished. Skipping ahead.`);
        const onExitToken: Runtime.Types.ProcessToken = flowNodeInstance.getTokenByType(Runtime.Types.ProcessTokenType.onExit);

        return this._continueAfterExit(onExitToken, processTokenFacade, processModelFacade);
      case Runtime.Types.FlowNodeInstanceState.error:
        this.logger.error(`Cannot resume ParallelJoinGateway instance ${flowNodeInstance.id}, because it previously exited with an error!`,
                     flowNodeInstance.error);
        throw flowNodeInstance.error;
      case Runtime.Types.FlowNodeInstanceState.terminated:
        const terminatedError: string = `Cannot resume ParallelJoinGateway instance ${flowNodeInstance.id}, because it was terminated!`;
        this.logger.error(terminatedError);
        throw new InternalServerError(terminatedError);
      default:
        const invalidStateError: string =
          `Cannot resume ParallelJoinGateway instance ${flowNodeInstance.id}, because its state cannot be determined!`;
        this.logger.error(invalidStateError);
        throw new InternalServerError(invalidStateError);
    }
  }

  protected async _executeHandler(token: Runtime.Types.ProcessToken,
                                  processTokenFacade: IProcessTokenFacade,
                                  processModelFacade: IProcessModelFacade,
                                  identity: IIdentity): Promise<NextFlowNodeInfo> {
    await this.persistOnExit(token);

    return this.getNextFlowNodeInfo(token, processTokenFacade, processModelFacade);
  }
}
