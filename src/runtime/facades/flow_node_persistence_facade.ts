import * as moment from 'moment';

import {ILoggingApi, LogLevel, MetricMeasurementPoint} from '@process-engine/logging_api_contracts';
import {IFlowNodeInstanceService, Model, ProcessToken} from '@process-engine/persistence_api.contracts';
import {IFlowNodePersistenceFacade} from '@process-engine/process_engine_contracts';

export class FlowNodePersistenceFacade implements IFlowNodePersistenceFacade {

  private flowNodeInstanceService: IFlowNodeInstanceService;
  private loggingApiService: ILoggingApi;

  constructor(
    flowNodeInstanceService: IFlowNodeInstanceService,
    loggingApiService: ILoggingApi,
  ) {
    this.flowNodeInstanceService = flowNodeInstanceService;
    this.loggingApiService = loggingApiService;
  }

  public async persistOnEnter(
    flowNode: Model.Base.FlowNode,
    flowNodeInstanceId: string,
    processToken: ProcessToken,
    previousFlowNodeInstanceId?: string,
  ): Promise<void> {

    await this.flowNodeInstanceService.persistOnEnter(flowNode, flowNodeInstanceId, processToken, previousFlowNodeInstanceId);

    const now = moment.utc().toDate();

    this.loggingApiService.writeLogForFlowNode(
      processToken.correlationId,
      processToken.processModelId,
      processToken.processInstanceId,
      flowNodeInstanceId,
      flowNode.id,
      LogLevel.info,
      MetricMeasurementPoint.onFlowNodeEnter,
      processToken.payload,
      'Flow Node execution started.',
      now,
    );
  }

  public async persistOnExit(
    flowNode: Model.Base.FlowNode,
    flowNodeInstanceId: string,
    processToken: ProcessToken,
  ): Promise<void> {

    await this.flowNodeInstanceService.persistOnExit(flowNode, flowNodeInstanceId, processToken);

    const now = moment.utc().toDate();

    this.loggingApiService.writeLogForFlowNode(
      processToken.correlationId,
      processToken.processModelId,
      processToken.processInstanceId,
      flowNodeInstanceId,
      flowNode.id,
      LogLevel.info,
      MetricMeasurementPoint.onFlowNodeExit,
      processToken.payload,
      'Flow Node execution finished.',
      now,
    );
  }

  public async persistOnTerminate(
    flowNode: Model.Base.FlowNode,
    flowNodeInstanceId: string,
    processToken: ProcessToken,
  ): Promise<void> {

    await this.flowNodeInstanceService.persistOnTerminate(flowNode, flowNodeInstanceId, processToken);

    const now = moment.utc().toDate();

    this.loggingApiService.writeLogForFlowNode(
      processToken.correlationId,
      processToken.processModelId,
      processToken.processInstanceId,
      flowNodeInstanceId,
      flowNode.id,
      LogLevel.error,
      MetricMeasurementPoint.onFlowNodeExit,
      processToken.payload,
      'Flow Node execution terminated.',
      now,
    );
  }

  public async persistOnError(
    flowNode: Model.Base.FlowNode,
    flowNodeInstanceId: string,
    processToken: ProcessToken,
    error: Error,
  ): Promise<void> {

    await this.flowNodeInstanceService.persistOnError(flowNode, flowNodeInstanceId, processToken, error);

    const now = moment.utc().toDate();

    this.loggingApiService.writeLogForFlowNode(
      processToken.correlationId,
      processToken.processModelId,
      processToken.processInstanceId,
      flowNodeInstanceId,
      flowNode.id,
      LogLevel.error,
      MetricMeasurementPoint.onFlowNodeError,
      processToken.payload,
      `Flow Node execution failed: ${error.message}`,
      now,
      error,
    );
  }

  public async persistOnSuspend(
    flowNode: Model.Base.FlowNode,
    flowNodeInstanceId: string,
    processToken: ProcessToken,
  ): Promise<void> {

    await this.flowNodeInstanceService.suspend(flowNode.id, flowNodeInstanceId, processToken);

    const now = moment.utc().toDate();

    this.loggingApiService.writeLogForFlowNode(
      processToken.correlationId,
      processToken.processModelId,
      processToken.processInstanceId,
      flowNodeInstanceId,
      flowNode.id,
      LogLevel.info,
      MetricMeasurementPoint.onFlowNodeSuspend,
      processToken.payload,
      'Flow Node execution suspended.',
      now,
    );
  }

  public async persistOnResume(
    flowNode: Model.Base.FlowNode,
    flowNodeInstanceId: string,
    processToken: ProcessToken,
  ): Promise<void> {

    await this.flowNodeInstanceService.resume(flowNode.id, flowNodeInstanceId, processToken);

    const now = moment.utc().toDate();

    this.loggingApiService.writeLogForFlowNode(
      processToken.correlationId,
      processToken.processModelId,
      processToken.processInstanceId,
      flowNodeInstanceId,
      flowNode.id,
      LogLevel.info,
      MetricMeasurementPoint.onFlowNodeResume,
      processToken.payload,
      'Flow Node execution resumed.',
      now,
    );
  }

}
