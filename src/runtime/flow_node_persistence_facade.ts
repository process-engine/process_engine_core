import * as moment from 'moment';

import {ILoggingApi, LogLevel} from '@process-engine/logging_api_contracts';
import {IMetricsApi} from '@process-engine/metrics_api_contracts';
import {IFlowNodeInstanceService, IFlowNodePersistenceFacade, Model, Runtime} from '@process-engine/process_engine_contracts';

export class FlowNodePersistenceFacade implements IFlowNodePersistenceFacade {

  private _flowNodeInstanceService: IFlowNodeInstanceService;
  private _loggingApiService: ILoggingApi;
  private _metricsApiService: IMetricsApi;

  constructor(
    flowNodeInstanceService: IFlowNodeInstanceService,
    loggingApiService: ILoggingApi,
    metricsApiService: IMetricsApi,
  ) {
    this._flowNodeInstanceService = flowNodeInstanceService;
    this._loggingApiService = loggingApiService;
    this._metricsApiService = metricsApiService;
  }

  public async persistOnEnter(
    flowNode: Model.Base.FlowNode,
    flowNodeInstanceId: string,
    processToken: Runtime.Types.ProcessToken,
    previousFlowNodeInstanceId?: string,
  ): Promise<void> {

    await this._flowNodeInstanceService.persistOnEnter(flowNode, flowNodeInstanceId, processToken, previousFlowNodeInstanceId);

    const now: moment.Moment = moment.utc();

    this._metricsApiService.writeOnFlowNodeInstanceEnter(processToken.correlationId,
                                                         processToken.processModelId,
                                                         flowNodeInstanceId,
                                                         flowNode.id,
                                                         processToken,
                                                         now);

    this._loggingApiService.writeLogForFlowNode(processToken.correlationId,
                                                processToken.processModelId,
                                                processToken.processInstanceId,
                                                flowNodeInstanceId,
                                                flowNode.id,
                                                LogLevel.info,
                                                'Flow Node execution started.');
  }

  public async persistOnExit(
    flowNode: Model.Base.FlowNode,
    flowNodeInstanceId: string,
    processToken: Runtime.Types.ProcessToken,
  ): Promise<void> {

    await this._flowNodeInstanceService.persistOnExit(flowNode, flowNodeInstanceId, processToken);

    const now: moment.Moment = moment.utc();

    this._metricsApiService.writeOnFlowNodeInstanceExit(processToken.correlationId,
                                                    processToken.processModelId,
                                                    flowNodeInstanceId,
                                                    flowNode.id,
                                                    processToken,
                                                    now);

    this._loggingApiService.writeLogForFlowNode(processToken.correlationId,
                                               processToken.processModelId,
                                               processToken.processInstanceId,
                                               flowNodeInstanceId,
                                               flowNode.id,
                                               LogLevel.info,
                                               'Flow Node execution finished.');
  }

  public async persistOnTerminate(
    flowNode: Model.Base.FlowNode,
    flowNodeInstanceId: string,
    processToken: Runtime.Types.ProcessToken,
  ): Promise<void> {

    await this._flowNodeInstanceService.persistOnTerminate(flowNode, flowNodeInstanceId, processToken);

    const now: moment.Moment = moment.utc();

    this._metricsApiService.writeOnFlowNodeInstanceExit(processToken.correlationId,
                                                    processToken.processModelId,
                                                    flowNodeInstanceId,
                                                    flowNode.id,
                                                    processToken,
                                                    now);

    this._loggingApiService.writeLogForFlowNode(processToken.correlationId,
                                               processToken.processModelId,
                                               processToken.processInstanceId,
                                               flowNodeInstanceId,
                                               flowNode.id,
                                               LogLevel.error,
                                               'Flow Node execution terminated.');
  }

  public async persistOnError(
    flowNode: Model.Base.FlowNode,
    flowNodeInstanceId: string,
    processToken: Runtime.Types.ProcessToken,
    error: Error,
  ): Promise<void> {

    await this._flowNodeInstanceService.persistOnError(flowNode, flowNodeInstanceId, processToken, error);

    const now: moment.Moment = moment.utc();

    this._metricsApiService.writeOnFlowNodeInstanceError(processToken.correlationId,
                                                     processToken.processModelId,
                                                     flowNodeInstanceId,
                                                     flowNode.id,
                                                     processToken,
                                                     error,
                                                     now);

    this._loggingApiService.writeLogForFlowNode(processToken.correlationId,
                                               processToken.processModelId,
                                               processToken.processInstanceId,
                                               flowNodeInstanceId,
                                               flowNode.id,
                                               LogLevel.error,
                                              `Flow Node execution failed: ${error.message}`);
  }

  public async persistOnSuspend(
    flowNode: Model.Base.FlowNode,
    flowNodeInstanceId: string,
    processToken: Runtime.Types.ProcessToken,
  ): Promise<void> {

    await this._flowNodeInstanceService.suspend(flowNode.id, flowNodeInstanceId, processToken);

    const now: moment.Moment = moment.utc();

    this._metricsApiService.writeOnFlowNodeInstanceSuspend(processToken.correlationId,
                                                       processToken.processModelId,
                                                       flowNodeInstanceId,
                                                       flowNode.id,
                                                       processToken,
                                                       now);

    this._loggingApiService.writeLogForFlowNode(processToken.correlationId,
                                               processToken.processModelId,
                                               processToken.processInstanceId,
                                               flowNodeInstanceId,
                                               flowNode.id,
                                               LogLevel.info,
                                               'Flow Node execution suspended.');
  }

  public async persistOnResume(
    flowNode: Model.Base.FlowNode,
    flowNodeInstanceId: string,
    processToken: Runtime.Types.ProcessToken,
  ): Promise<void> {

    await this._flowNodeInstanceService.resume(flowNode.id, flowNodeInstanceId, processToken);

    const now: moment.Moment = moment.utc();

    this._metricsApiService.writeOnFlowNodeInstanceResume(processToken.correlationId,
                                                      processToken.processModelId,
                                                      flowNodeInstanceId,
                                                      flowNode.id,
                                                      processToken,
                                                      now);

    this._loggingApiService.writeLogForFlowNode(processToken.correlationId,
                                               processToken.processModelId,
                                               processToken.processInstanceId,
                                               flowNodeInstanceId,
                                               flowNode.id,
                                               LogLevel.info,
                                               'Flow Node execution resumed.');
  }
}
