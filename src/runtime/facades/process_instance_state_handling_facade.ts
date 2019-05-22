import * as moment from 'moment';

import {InternalServerError} from '@essential-projects/errors_ts';
import {IEventAggregator} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';

import {CorrelationState, ICorrelationService} from '@process-engine/correlation.contracts';
import {ILoggingApi, LogLevel} from '@process-engine/logging_api_contracts';
import {IMetricsApi} from '@process-engine/metrics_api_contracts';
import {
  IFlowNodeInstanceResult,
  ProcessEndedMessage,
  ProcessErrorMessage,
  ProcessTerminatedMessage,
  eventAggregatorSettings,
} from '@process-engine/process_engine_contracts';
import {IProcessModelUseCases} from '@process-engine/process_model.contracts';

import {IProcessInstanceConfig} from './iprocess_instance_config';

export class ProcessInstanceStateHandlingFacade {

  private readonly correlationService: ICorrelationService;
  private readonly eventAggregator: IEventAggregator;
  private readonly loggingApiService: ILoggingApi;
  private readonly metricsApiService: IMetricsApi;
  private readonly processModelUseCases: IProcessModelUseCases;

  constructor(
    correlationService: ICorrelationService,
    eventAggregator: IEventAggregator,
    loggingApiService: ILoggingApi,
    metricsApiService: IMetricsApi,
    processModelUseCases: IProcessModelUseCases,
  ) {
    this.correlationService = correlationService;
    this.eventAggregator = eventAggregator;
    this.loggingApiService = loggingApiService;
    this.metricsApiService = metricsApiService;
    this.processModelUseCases = processModelUseCases;
  }

  /**
   * Creates a new entry in the database that links a ProcessInstance with a
   * Correlation.
   *
   * @async
   * @param   identity              The identity of the requesting user.
   * @param   processInstanceConfig The configs for the ProcessInstance.
   */
  public async saveCorrelation(identity: IIdentity, processInstanceConfig: IProcessInstanceConfig): Promise<void> {

    const processDefinition = await this.processModelUseCases.getProcessDefinitionAsXmlByName(identity, processInstanceConfig.processModelId);

    await this.correlationService.createEntry(
      identity,
      processInstanceConfig.correlationId,
      processInstanceConfig.processInstanceId,
      processDefinition.name,
      processDefinition.hash,
      processInstanceConfig.parentProcessInstanceId,
    );

    this.logProcessStarted(processInstanceConfig.correlationId, processInstanceConfig.processModelId, processInstanceConfig.processInstanceId);
  }

  /**
   * Finishes the given ProcessInstance in the given correlation, using the given result.
   *
   * @async
   * @param   identity              The identity of the requesting user.
   * @param   processInstanceConfig The configs for the ProcessInstance.
   * @param   resultToken           The result with which to finish the ProcessInstance.
   */
  public async finishProcessInstanceInCorrelation(
    identity: IIdentity,
    processInstanceConfig: IProcessInstanceConfig,
    resultToken: IFlowNodeInstanceResult,
  ): Promise<void> {

    await this
      .correlationService
      .finishProcessInstanceInCorrelation(identity, processInstanceConfig.correlationId, processInstanceConfig.processInstanceId);

    this.logProcessFinished(processInstanceConfig.correlationId, processInstanceConfig.processModelId, processInstanceConfig.processInstanceId);

    this.sendProcessInstanceFinishedNotification(identity, processInstanceConfig, resultToken);
  }

  /**
   * Finishes the given ProcessInstance in the given correlation, using the given error.
   *
   * @async
   * @param   identity              The identity of the requesting user.
   * @param   processInstanceConfig The configs for the ProcessInstance.
   * @param   error                 The error that occured.
   */
  public async finishProcessInstanceInCorrelationWithError(
    identity: IIdentity,
    processInstanceConfig: IProcessInstanceConfig,
    error: Error,
  ): Promise<void> {

    await this
      .correlationService
      .finishProcessInstanceInCorrelationWithError(identity, processInstanceConfig.correlationId, processInstanceConfig.processInstanceId, error);

    this.logProcessError(processInstanceConfig.correlationId, processInstanceConfig.processModelId, processInstanceConfig.processInstanceId, error);

    this.sendProcessInstanceErrorNotification(identity, processInstanceConfig, error);
  }

  public sendProcessInstanceFinishedNotification(
    identity: IIdentity,
    processInstanceConfig: IProcessInstanceConfig,
    resultToken: IFlowNodeInstanceResult,
  ): void {

    // Send notification about the finished ProcessInstance.
    const instanceFinishedEventName = eventAggregatorSettings.messagePaths.processInstanceWithIdEnded
      .replace(eventAggregatorSettings.messageParams.processInstanceId, processInstanceConfig.processInstanceId);

    const instanceFinishedMessage: ProcessEndedMessage = new ProcessEndedMessage(
      processInstanceConfig.correlationId,
      processInstanceConfig.processModelId,
      processInstanceConfig.processInstanceId,
      resultToken.flowNodeId,
      resultToken.flowNodeInstanceId,
      identity,
      resultToken.result,
    );

    this.eventAggregator.publish(instanceFinishedEventName, instanceFinishedMessage);
  }

  public sendProcessInstanceErrorNotification(identity: IIdentity, processInstanceConfig: IProcessInstanceConfig, error: Error): void {

    // Send notification about the finished ProcessInstance.
    const instanceFinishedEventName = eventAggregatorSettings.messagePaths.processInstanceWithIdErrored
      .replace(eventAggregatorSettings.messageParams.processInstanceId, processInstanceConfig.processInstanceId);

    const instanceErroredMessage: ProcessErrorMessage = new ProcessErrorMessage(
      processInstanceConfig.correlationId,
      processInstanceConfig.processModelId,
      processInstanceConfig.processInstanceId,
      undefined,
      undefined,
      identity,
      error,
    );

    this.eventAggregator.publish(instanceFinishedEventName, instanceErroredMessage);
    this.eventAggregator.publish(eventAggregatorSettings.messagePaths.processError, instanceErroredMessage);
  }

  public async terminateSubprocesses(identity: IIdentity, processInstanceId: string): Promise<void> {

    const correlation =
      await this.correlationService.getSubprocessesForProcessInstance(identity, processInstanceId);

    const noSubprocessesFound = !correlation || !correlation.processInstances || correlation.processInstances.length === 0;
    if (noSubprocessesFound) {
      return;
    }

    for (const subprocess of correlation.processInstances) {

      const subprocessIsAlreadyFinished = subprocess.state !== CorrelationState.running;
      if (subprocessIsAlreadyFinished) {
        continue;
      }

      const terminateProcessMessage: string = eventAggregatorSettings.messagePaths.processInstanceWithIdTerminated
        .replace(eventAggregatorSettings.messageParams.processInstanceId, subprocess.processInstanceId);

      const terminationMessage = new ProcessTerminatedMessage(
        correlation.id,
        subprocess.processModelId,
        subprocess.processInstanceId,
        undefined,
        undefined,
        subprocess.identity,
        new InternalServerError(`Process terminated by parent ProcessInstance ${processInstanceId}`),
      );

      this.eventAggregator.publish(terminateProcessMessage, terminationMessage);
    }
  }

  /**
   * Writes logs and metrics at the beginning of a ProcessInstance's execution.
   *
   * @param correlationId     The ProcessInstance's CorrelationId.
   * @param processModelId    The ProcessInstance's ProcessModelId.
   * @param processInstanceId The ID of the ProcessInstance.
   */
  public logProcessStarted(correlationId: string, processModelId: string, processInstanceId: string): void {

    const startTime = moment.utc();

    this.metricsApiService.writeOnProcessStarted(correlationId, processModelId, startTime);

    this.loggingApiService.writeLogForProcessModel(
      correlationId,
      processModelId,
      processInstanceId,
      LogLevel.info,
      'Process instance started.',
      startTime.toDate(),
    );

  }

  /**
   * Writes logs and metrics at the beginning of a ProcessInstance's resumption.
   *
   * @param correlationId     The ProcessInstance's CorrelationId.
   * @param processModelId    The ProcessInstance's ProcessModelId.
   * @param processInstanceId The ID of the ProcessInstance.
   */
  public logProcessResumed(correlationId: string, processModelId: string, processInstanceId: string): void {

    const startTime = moment.utc();

    this.metricsApiService.writeOnProcessStarted(correlationId, processModelId, startTime);

    this.loggingApiService.writeLogForProcessModel(
      correlationId,
      processModelId,
      processInstanceId,
      LogLevel.info,
      'ProcessInstance resumed.',
      startTime.toDate(),
    );
  }

  /**
   * Writes logs and metrics after a ProcessInstance finishes execution.
   *
   * @param correlationId     The ProcessInstance's CorrelationId.
   * @param processModelId    The ProcessInstance's ProcessModelId.
   * @param processInstanceId The ID of the ProcessInstance.
   */
  public logProcessFinished(correlationId: string, processModelId: string, processInstanceId: string): void {

    const endTime = moment.utc();

    this.metricsApiService.writeOnProcessFinished(correlationId, processModelId, endTime);

    this.loggingApiService.writeLogForProcessModel(
      correlationId,
      processModelId,
      processInstanceId,
      LogLevel.info,
      'Process instance finished.',
      endTime.toDate(),
    );
  }

  /**
   * Writes logs and metrics when a ProcessInstances was interrupted by an error.
   *
   * @param correlationId     The ProcessInstance's CorrelationId.
   * @param processModelId    The ProcessInstance's ProcessModelId.
   * @param processInstanceId The ID of the ProcessInstance.
   */
  public logProcessError(correlationId: string, processModelId: string, processInstanceId: string, error: Error): void {

    const errorTime = moment.utc();

    this.metricsApiService.writeOnProcessError(correlationId, processModelId, error, errorTime);

    this.loggingApiService.writeLogForProcessModel(
      correlationId,
      processModelId,
      processInstanceId,
      LogLevel.error,
      error.message,
      errorTime.toDate(),
    );
  }

}
