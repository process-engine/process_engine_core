import * as moment from 'moment';

import {ILoggingApi, LogLevel} from '@process-engine/logging_api_contracts';
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

    const now = moment.utc();

    this.loggingApiService.writeLogForFlowNode(
      processToken.correlationId,
      processToken.processModelId,
      processToken.processInstanceId,
      flowNodeInstanceId,
      flowNode.id,
      LogLevel.info,
      'Flow Node execution started.',
    );
  }

  public async persistOnExit(
    flowNode: Model.Base.FlowNode,
    flowNodeInstanceId: string,
    processToken: ProcessToken,
  ): Promise<void> {

    await this.flowNodeInstanceService.persistOnExit(flowNode, flowNodeInstanceId, processToken);

    const now = moment.utc();

    this.loggingApiService.writeLogForFlowNode(
      processToken.correlationId,
      processToken.processModelId,
      processToken.processInstanceId,
      flowNodeInstanceId,
      flowNode.id,
      LogLevel.info,
      'Flow Node execution finished.',
    );
  }

  public async persistOnTerminate(
    flowNode: Model.Base.FlowNode,
    flowNodeInstanceId: string,
    processToken: ProcessToken,
  ): Promise<void> {

    await this.flowNodeInstanceService.persistOnTerminate(flowNode, flowNodeInstanceId, processToken);

    const now = moment.utc();

    this.loggingApiService.writeLogForFlowNode(
      processToken.correlationId,
      processToken.processModelId,
      processToken.processInstanceId,
      flowNodeInstanceId,
      flowNode.id,
      LogLevel.error,
      'Flow Node execution terminated.',
    );
  }

  public async persistOnError(
    flowNode: Model.Base.FlowNode,
    flowNodeInstanceId: string,
    processToken: ProcessToken,
    error: Error,
  ): Promise<void> {

    await this.flowNodeInstanceService.persistOnError(flowNode, flowNodeInstanceId, processToken, error);

    const now = moment.utc();

    this.loggingApiService.writeLogForFlowNode(
      processToken.correlationId,
      processToken.processModelId,
      processToken.processInstanceId,
      flowNodeInstanceId,
      flowNode.id,
      LogLevel.error,
      `Flow Node execution failed: ${error.message}`,
    );
  }

  public async persistOnSuspend(
    flowNode: Model.Base.FlowNode,
    flowNodeInstanceId: string,
    processToken: ProcessToken,
  ): Promise<void> {

    await this.flowNodeInstanceService.suspend(flowNode.id, flowNodeInstanceId, processToken);

    const now = moment.utc();

    this.loggingApiService.writeLogForFlowNode(
      processToken.correlationId,
      processToken.processModelId,
      processToken.processInstanceId,
      flowNodeInstanceId,
      flowNode.id,
      LogLevel.info,
      'Flow Node execution suspended.',
    );
  }

  public async persistOnResume(
    flowNode: Model.Base.FlowNode,
    flowNodeInstanceId: string,
    processToken: ProcessToken,
  ): Promise<void> {

    await this.flowNodeInstanceService.resume(flowNode.id, flowNodeInstanceId, processToken);

    const now = moment.utc();

    this.loggingApiService.writeLogForFlowNode(
      processToken.correlationId,
      processToken.processModelId,
      processToken.processInstanceId,
      flowNodeInstanceId,
      flowNode.id,
      LogLevel.info,
      'Flow Node execution resumed.',
    );
  }

}
