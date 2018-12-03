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

const logger: Logger = Logger.createLogger('processengine:runtime:parallel_join_gateway');

import {FlowNodeHandler} from '../index';

export class ParallelJoinGatewayHandler extends FlowNodeHandler<Model.Gateways.ParallelGateway> {

  constructor(flowNodeInstanceService: IFlowNodeInstanceService,
              loggingApiService: ILoggingApi,
              metricsService: IMetricsApi,
              parallelGatewayModel: Model.Gateways.ParallelGateway) {
    super(flowNodeInstanceService, loggingApiService, metricsService, parallelGatewayModel);
  }

  protected async executeInternally(token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    identity: IIdentity): Promise<NextFlowNodeInfo> {
    await this.persistOnEnter(token);

    return await this._executeHandler(token, processTokenFacade, processModelFacade, identity);
  }

  protected async resumeInternally(flowNodeInstance: Runtime.Types.FlowNodeInstance,
                                   processTokenFacade: IProcessTokenFacade,
                                   processModelFacade: IProcessModelFacade,
                                   identity: IIdentity,
                                  ): Promise<NextFlowNodeInfo> {

    function getFlowNodeInstanceTokenByType(tokenType: Runtime.Types.ProcessTokenType): Runtime.Types.ProcessToken {
      return flowNodeInstance.tokens.find((token: Runtime.Types.ProcessToken): boolean => {
        return token.type === tokenType;
      });
    }

    logger.verbose(`Resuming ParallelJoinGateway ${flowNodeInstance.flowNodeId} with instance ID ${flowNodeInstance.id}.`);

    switch (flowNodeInstance.state) {
      case Runtime.Types.FlowNodeInstanceState.running:
        logger.verbose(`ParallelJoinGateway was unfinished. Resuming from the start.`);
        const onEnterToken: Runtime.Types.ProcessToken = getFlowNodeInstanceTokenByType(Runtime.Types.ProcessTokenType.onEnter);

        return this._continueAfterEnter(onEnterToken, processTokenFacade, processModelFacade, identity);
      case Runtime.Types.FlowNodeInstanceState.finished:
        logger.verbose(`ParallelJoinGateway was already finished. Skipping ahead.`);
        const onExitToken: Runtime.Types.ProcessToken = getFlowNodeInstanceTokenByType(Runtime.Types.ProcessTokenType.onExit);

        return this._continueAfterExit(onExitToken, processTokenFacade, processModelFacade);
      case Runtime.Types.FlowNodeInstanceState.error:
        logger.error(`Cannot resume ParallelJoinGateway instance ${flowNodeInstance.id}, because it previously exited with an error!`,
                     flowNodeInstance.error);
        throw flowNodeInstance.error;
      case Runtime.Types.FlowNodeInstanceState.terminated:
        const terminatedError: string = `Cannot resume ParallelJoinGateway instance ${flowNodeInstance.id}, because it was terminated!`;
        logger.error(terminatedError);
        throw new InternalServerError(terminatedError);
      default:
        const invalidStateError: string =
          `Cannot resume ParallelJoinGateway instance ${flowNodeInstance.id}, because its state cannot be determined!`;
        logger.error(invalidStateError);
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
