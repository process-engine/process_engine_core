import * as moment from 'moment';

import {InternalServerError} from '@essential-projects/errors_ts';
import {IEventAggregator} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';

import {Correlation, CorrelationState, ICorrelationService} from '@process-engine/correlation.contracts';
import {ILoggingApi, LogLevel} from '@process-engine/logging_api_contracts';
import {IMetricsApi} from '@process-engine/metrics_api_contracts';
import {
  eventAggregatorSettings,
  IFlowNodeInstanceResult,
  ProcessEndedMessage,
  ProcessErrorMessage,
  ProcessTerminatedMessage,
} from '@process-engine/process_engine_contracts';
import {IProcessModelUseCases, ProcessDefinitionFromRepository} from '@process-engine/process_model.contracts';

import {IProcessInstanceConfig} from './iprocess_instance_config';

export class ProcessInstanceStateHandlingFacade {

  private readonly _correlationService: ICorrelationService;
  private readonly _eventAggregator: IEventAggregator;
  private readonly _loggingApiService: ILoggingApi;
  private readonly _metricsApiService: IMetricsApi;
  private readonly _processModelUseCases: IProcessModelUseCases;

  constructor(
    correlationService: ICorrelationService,
    eventAggregator: IEventAggregator,
    loggingApiService: ILoggingApi,
    metricsApiService: IMetricsApi,
    processModelUseCases: IProcessModelUseCases,
  ) {
    this._correlationService = correlationService;
    this._eventAggregator = eventAggregator;
    this._loggingApiService = loggingApiService;
    this._metricsApiService = metricsApiService;
    this._processModelUseCases = processModelUseCases;
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

    const processDefinition: ProcessDefinitionFromRepository =
      await this._processModelUseCases.getProcessDefinitionAsXmlByName(identity, processInstanceConfig.processModelId);

    await this._correlationService.createEntry(identity,
                                               processInstanceConfig.correlationId,
                                               processInstanceConfig.processInstanceId,
                                               processDefinition.name,
                                               processDefinition.hash,
                                               processInstanceConfig.parentProcessInstanceId);

    this._logProcessStarted(processInstanceConfig.correlationId, processInstanceConfig.processModelId, processInstanceConfig.processInstanceId);
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
      ._correlationService
      .finishProcessInstanceInCorrelation(identity, processInstanceConfig.correlationId, processInstanceConfig.processInstanceId);

    this._logProcessFinished(processInstanceConfig.correlationId, processInstanceConfig.processModelId, processInstanceConfig.processInstanceId);

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
      ._correlationService
      .finishProcessInstanceInCorrelationWithError(identity, processInstanceConfig.correlationId, processInstanceConfig.processInstanceId, error);

    this._logProcessError(processInstanceConfig.correlationId, processInstanceConfig.processModelId, processInstanceConfig.processInstanceId, error);

    this.sendProcessInstanceErrorNotification(identity, processInstanceConfig, error);
  }

  public sendProcessInstanceFinishedNotification(
    identity: IIdentity,
    processInstanceConfig: IProcessInstanceConfig,
    resultToken: IFlowNodeInstanceResult,
  ): void {

    // Send notification about the finished ProcessInstance.
    const instanceFinishedEventName: string = eventAggregatorSettings.messagePaths.processInstanceWithIdEnded
      .replace(eventAggregatorSettings.messageParams.processInstanceId, processInstanceConfig.processInstanceId);

    const instanceFinishedMessage: ProcessEndedMessage = new ProcessEndedMessage(
      processInstanceConfig.correlationId,
      processInstanceConfig.processModelId,
      processInstanceConfig.processInstanceId,
      resultToken.flowNodeId,
      resultToken.flowNodeInstanceId,
      identity,
      resultToken.result);

    this._eventAggregator.publish(instanceFinishedEventName, instanceFinishedMessage);
  }

  public sendProcessInstanceErrorNotification(identity: IIdentity, processInstanceConfig: IProcessInstanceConfig, error: Error): void {

    // Send notification about the finished ProcessInstance.
    const instanceFinishedEventName: string = eventAggregatorSettings.messagePaths.processInstanceWithIdErrored
      .replace(eventAggregatorSettings.messageParams.processInstanceId, processInstanceConfig.processInstanceId);

    const instanceErroredMessage: ProcessErrorMessage = new ProcessErrorMessage(
      processInstanceConfig.correlationId,
      processInstanceConfig.processModelId,
      processInstanceConfig.processInstanceId,
      undefined,
      undefined,
      identity,
      error);

    this._eventAggregator.publish(instanceFinishedEventName, instanceErroredMessage);
    this._eventAggregator.publish(eventAggregatorSettings.messagePaths.processError, instanceErroredMessage);
  }

  public async terminateSubprocesses(identity: IIdentity, processInstanceId: string): Promise<void> {

    const correlation: Correlation =
      await this._correlationService.getSubprocessesForProcessInstance(identity, processInstanceId);

    for (const subprocess of correlation.processModels) {

      const subprocessIsAlreadyFinished: boolean = subprocess.state !== CorrelationState.running;
      if (subprocessIsAlreadyFinished) {
        continue;
      }

      const terminateProcessMessage: string = eventAggregatorSettings.messagePaths.processInstanceWithIdTerminated
        .replace(eventAggregatorSettings.messageParams.processInstanceId, subprocess.processInstanceId);

      const terminationMessage: ProcessTerminatedMessage = new ProcessTerminatedMessage(
        correlation.id,
        subprocess.processModelId,
        subprocess.processInstanceId,
        undefined,
        undefined,
        correlation.identity,
        new InternalServerError(`Process terminated by parent ProcessInstance ${processInstanceId}`),
      );

      this._eventAggregator.publish(terminateProcessMessage, terminationMessage);
    }
  }

  /**
   * Writes logs and metrics at the beginning of a ProcessInstance's execution.
   *
   * @param correlationId     The ProcessInstance's CorrelationId.
   * @param processModelId    The ProcessInstance's ProcessModelId.
   * @param processInstanceId The ID of the ProcessInstance.
   */
  private _logProcessStarted(correlationId: string, processModelId: string, processInstanceId: string): void {

    const startTime: moment.Moment = moment.utc();

    this._loggingApiService.writeLogForProcessModel(correlationId,
                                                    processModelId,
                                                    processInstanceId,
                                                    LogLevel.info,
                                                    `Process instance started.`,
                                                    startTime.toDate());

    this._metricsApiService.writeOnProcessStarted(correlationId, processModelId, startTime);

  }

  /**
   * Writes logs and metrics after a ProcessInstance finishes execution.
   *
   * @param correlationId     The ProcessInstance's CorrelationId.
   * @param processModelId    The ProcessInstance's ProcessModelId.
   * @param processInstanceId The ID of the ProcessInstance.
   */
  private _logProcessFinished(correlationId: string, processModelId: string, processInstanceId: string): void {

    const endTime: moment.Moment = moment.utc();

    this._metricsApiService.writeOnProcessFinished(correlationId, processModelId, endTime);

    this._loggingApiService.writeLogForProcessModel(correlationId,
                                                    processModelId,
                                                    processInstanceId,
                                                    LogLevel.info,
                                                    `Process instance finished.`,
                                                    endTime.toDate());
  }

  /**
   * Writes logs and metrics when a ProcessInstances was interrupted by an error.
   *
   * @param correlationId     The ProcessInstance's CorrelationId.
   * @param processModelId    The ProcessInstance's ProcessModelId.
   * @param processInstanceId The ID of the ProcessInstance.
   */
  private _logProcessError(correlationId: string, processModelId: string, processInstanceId: string, error: Error): void {

    const errorTime: moment.Moment = moment.utc();

    this._metricsApiService.writeOnProcessError(correlationId, processModelId, error, errorTime);

    this._loggingApiService.writeLogForProcessModel(correlationId,
                                                    processModelId,
                                                    processInstanceId,
                                                    LogLevel.error,
                                                    error.message,
                                                    errorTime.toDate());
  }
}
