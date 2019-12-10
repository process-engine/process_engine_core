import * as moment from 'moment';

import {BadRequestError, BaseError, InternalServerError} from '@essential-projects/errors_ts';
import {IEventAggregator} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';

import {ILoggingApi, LogLevel, MetricMeasurementPoint} from '@process-engine/logging_api_contracts';
import {CorrelationState, ICorrelationService, IProcessModelUseCases} from '@process-engine/persistence_api.contracts';
import {
  IFlowNodeInstanceResult,
  ProcessEndedMessage,
  ProcessErrorMessage,
  ProcessTerminatedMessage,
  eventAggregatorSettings,
} from '@process-engine/process_engine_contracts';

import {IProcessInstanceConfig} from './iprocess_instance_config';

export class ProcessInstanceStateHandlingFacade {

  private readonly correlationService: ICorrelationService;
  private readonly eventAggregator: IEventAggregator;
  private readonly loggingApiService: ILoggingApi;
  private readonly processModelUseCases: IProcessModelUseCases;

  constructor(
    correlationService: ICorrelationService,
    eventAggregator: IEventAggregator,
    loggingApiService: ILoggingApi,
    processModelUseCases: IProcessModelUseCases,
  ) {
    this.correlationService = correlationService;
    this.eventAggregator = eventAggregator;
    this.loggingApiService = loggingApiService;
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
  public async saveProcessInstance(identity: IIdentity, processInstanceConfig: IProcessInstanceConfig): Promise<void> {

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
  public async finishProcessInstance(
    identity: IIdentity,
    processInstanceConfig: IProcessInstanceConfig,
    resultToken: IFlowNodeInstanceResult,
  ): Promise<void> {

    const {correlationId, processInstanceId, processModelId} = processInstanceConfig;

    await this
      .correlationService
      .finishProcessInstanceInCorrelation(identity, correlationId, processInstanceId);

    this.logProcessFinished(correlationId, processModelId, processInstanceId);

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
  public async finishProcessInstanceWithError(
    identity: IIdentity,
    processInstanceConfig: IProcessInstanceConfig,
    error: BaseError,
  ): Promise<void> {

    const {correlationId, processInstanceId, processModelId} = processInstanceConfig;

    const identityToUse = error.additionalInformation?.terminatedBy ?? identity;

    await this
      .correlationService
      .finishProcessInstanceInCorrelationWithError(identityToUse, correlationId, processInstanceId, error);

    this.logProcessError(correlationId, processModelId, processInstanceId, error);

    const terminationRegex = /terminated/i;
    const isTerminationError = terminationRegex.test(error.message);

    if (isTerminationError) {
      this.sendProcessInstanceTerminationNotification(identityToUse, processInstanceConfig, error);
    } else {
      this.sendProcessInstanceErrorNotification(identityToUse, processInstanceConfig, error);
    }
  }

  public sendProcessInstanceFinishedNotification(
    identity: IIdentity,
    processInstanceConfig: IProcessInstanceConfig,
    resultToken: IFlowNodeInstanceResult,
  ): void {

    // Send notification about the finished ProcessInstance.
    const instanceFinishedEventName = eventAggregatorSettings.messagePaths.processInstanceWithIdEnded
      .replace(eventAggregatorSettings.messageParams.processInstanceId, processInstanceConfig.processInstanceId);

    const message = new ProcessEndedMessage(
      processInstanceConfig.correlationId,
      processInstanceConfig.processModelId,
      processInstanceConfig.processInstanceId,
      resultToken.flowNodeId,
      resultToken.flowNodeInstanceId,
      identity,
      resultToken.result,
    );

    // Instance specific notification
    this.eventAggregator.publish(instanceFinishedEventName, message);
    // Generic notification
    this.eventAggregator.publish(eventAggregatorSettings.messagePaths.processEnded, message);
  }

  public sendProcessInstanceErrorNotification(identity: IIdentity, processInstanceConfig: IProcessInstanceConfig, error: Error): void {

    const instanceErrorEventName = eventAggregatorSettings.messagePaths.processInstanceWithIdErrored
      .replace(eventAggregatorSettings.messageParams.processInstanceId, processInstanceConfig.processInstanceId);

    const instanceErroredMessage = new ProcessErrorMessage(
      processInstanceConfig.correlationId,
      processInstanceConfig.processModelId,
      processInstanceConfig.processInstanceId,
      undefined,
      undefined,
      identity,
      error,
    );

    // Instance specific notification
    this.eventAggregator.publish(instanceErrorEventName, instanceErroredMessage);
    // Generic notification
    this.eventAggregator.publish(eventAggregatorSettings.messagePaths.processError, instanceErroredMessage);
  }

  public sendProcessInstanceTerminationNotification(identity: IIdentity, processInstanceConfig: IProcessInstanceConfig, error: Error): void {

    const eventName = eventAggregatorSettings.messagePaths.processInstanceWithIdTerminated
      .replace(eventAggregatorSettings.messageParams.processInstanceId, processInstanceConfig.processInstanceId);

    const message = new ProcessTerminatedMessage(
      processInstanceConfig.correlationId,
      processInstanceConfig.processModelId,
      processInstanceConfig.processInstanceId,
      undefined,
      undefined,
      identity,
      error,
    );

    // Instance specific notification
    this.eventAggregator.publish(eventName, message);
    // Generic notification
    this.eventAggregator.publish(eventAggregatorSettings.messagePaths.processTerminated, message);
  }

  public async terminateSubprocesses(identity: IIdentity, processInstanceId: string): Promise<void> {

    if (!processInstanceId) {
      throw new BadRequestError('Must provide a value for processInstanceId to "terminateSubprocesses"!');
    }

    const processInstances =
      await this.correlationService.getSubprocessesForProcessInstance(identity, processInstanceId);

    const noSubprocessesFound = !(processInstances?.length > 0);
    if (noSubprocessesFound) {
      return;
    }

    for (const subprocess of processInstances) {

      const subprocessIsAlreadyFinished = subprocess.state !== CorrelationState.running;
      if (subprocessIsAlreadyFinished) {
        continue;
      }

      const terminateProcessMessage = eventAggregatorSettings.messagePaths.processInstanceWithIdTerminated
        .replace(eventAggregatorSettings.messageParams.processInstanceId, subprocess.processInstanceId);

      const terminationMessage = new ProcessTerminatedMessage(
        subprocess.correlationId,
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

    this.loggingApiService.writeLogForProcessModel(
      correlationId,
      processModelId,
      processInstanceId,
      LogLevel.info,
      MetricMeasurementPoint.onProcessStart,
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

    this.loggingApiService.writeLogForProcessModel(
      correlationId,
      processModelId,
      processInstanceId,
      LogLevel.info,
      MetricMeasurementPoint.onProcessStart,
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

    this.loggingApiService.writeLogForProcessModel(
      correlationId,
      processModelId,
      processInstanceId,
      LogLevel.info,
      MetricMeasurementPoint.onProcessFinish,
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

    this.loggingApiService.writeLogForProcessModel(
      correlationId,
      processModelId,
      processInstanceId,
      LogLevel.error,
      MetricMeasurementPoint.onProcessError,
      `ProcessInstance exited with an error: ${error.message}`,
      errorTime.toDate(),
      error,
    );
  }

}
