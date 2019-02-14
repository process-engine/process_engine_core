import * as moment from 'moment';
import * as uuid from 'node-uuid';

import {InternalServerError} from '@essential-projects/errors_ts';
import {EventReceivedCallback, IEventAggregator, Subscription} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';

import {ILoggingApi, LogLevel} from '@process-engine/logging_api_contracts';
import {IMetricsApi} from '@process-engine/metrics_api_contracts';
import {
  EndEventReachedMessage,
  eventAggregatorSettings,
  ICorrelationService,
  IExecuteProcessService,
  IFlowNodeHandler,
  IFlowNodeHandlerFactory,
  IFlowNodeInstanceResult,
  IProcessModelFacade,
  IProcessModelService,
  IProcessTokenFacade,
  Model,
  ProcessEndedMessage,
  ProcessStartedMessage,
  Runtime,
} from '@process-engine/process_engine_contracts';

import {ProcessModelFacade} from './process_model_facade';
import {ProcessTokenFacade} from './process_token_facade';

/**
 * Contains all infos about a specific ProcessInstance.
 *
 * Only use internally.
 */
interface IProcessInstanceConfig {
  correlationId: string;
  processModelId: string;
  processInstanceId: string;
  parentProcessInstanceId: string;
  processModelFacade: IProcessModelFacade;
  startEvent: Model.Events.StartEvent;
  processToken: Runtime.Types.ProcessToken;
  processTokenFacade: IProcessTokenFacade;
}

export class ExecuteProcessService implements IExecuteProcessService {

  private readonly _eventAggregator: IEventAggregator;
  private readonly _flowNodeHandlerFactory: IFlowNodeHandlerFactory;

  private readonly _correlationService: ICorrelationService;
  private readonly _loggingApiService: ILoggingApi;
  private readonly _metricsApiService: IMetricsApi;
  private readonly _processModelService: IProcessModelService;

  constructor(
    correlationService: ICorrelationService,
    eventAggregator: IEventAggregator,
    flowNodeHandlerFactory: IFlowNodeHandlerFactory,
    loggingApiService: ILoggingApi,
    metricsApiService: IMetricsApi,
    processModelService: IProcessModelService,
  ) {
    this._correlationService = correlationService;
    this._eventAggregator = eventAggregator;
    this._flowNodeHandlerFactory = flowNodeHandlerFactory;
    this._loggingApiService = loggingApiService;
    this._metricsApiService = metricsApiService;
    this._processModelService = processModelService;
  }

  public async start(
    identity: IIdentity,
    processModel: Model.Types.Process,
    startEventId: string,
    correlationId: string,
    initialPayload?: any,
    caller?: string,
  ): Promise<ProcessStartedMessage> {

    const processInstanceConfig: IProcessInstanceConfig =
      this._createProcessInstanceConfig(identity, processModel, correlationId, startEventId, initialPayload, caller);

    // This UseCase is designed to resolve immediately after the ProcessInstance
    // was started, so we must not await the execution here.
    this._executeProcess(identity, processInstanceConfig);

    return new ProcessStartedMessage(correlationId,
                                     processModel.id,
                                     processInstanceConfig.processInstanceId,
                                     startEventId,
                                     // We don't yet know the StartEvent's instanceId, because it hasn't been created yet.
                                     // It will be contained in the ProcessStarted Notification that the StartEventHandler sends.
                                     undefined,
                                     identity,
                                     initialPayload);
  }

  public async startAndAwaitEndEvent(
    identity: IIdentity,
    processModel: Model.Types.Process,
    startEventId: string,
    correlationId: string,
    initialPayload?: any,
    caller?: string,
  ): Promise<EndEventReachedMessage> {
    return this._startAndAwaitEndEvent(identity, processModel, startEventId, correlationId, initialPayload, caller);
  }

  public async startAndAwaitSpecificEndEvent(
    identity: IIdentity,
    processModel: Model.Types.Process,
    startEventId: string,
    correlationId: string,
    endEventId: string,
    initialPayload?: any,
    caller?: string,
  ): Promise<EndEventReachedMessage> {
    return this._startAndAwaitEndEvent(identity, processModel, startEventId, correlationId, initialPayload, caller, endEventId);
  }

  private async _startAndAwaitEndEvent(
    identity: IIdentity,
    processModel: Model.Types.Process,
    startEventId: string,
    correlationId: string,
    initialPayload?: any,
    caller?: string,
    endEventId?: string,
  ): Promise<EndEventReachedMessage> {

    return new Promise<EndEventReachedMessage>(async(resolve: Function, reject: Function): Promise<void> => {

      const processInstanceConfig: IProcessInstanceConfig =
        this._createProcessInstanceConfig(identity, processModel, correlationId, startEventId, initialPayload, caller);

      const processEndMessageName: string = eventAggregatorSettings.messagePaths.endEventReached
        .replace(eventAggregatorSettings.messageParams.correlationId, processInstanceConfig.correlationId)
        .replace(eventAggregatorSettings.messageParams.processModelId, processModel.id);

      let eventSubscription: Subscription;

      const messageReceivedCallback: EventReceivedCallback = async(message: EndEventReachedMessage): Promise<void> => {
        const isAwaitedEndEvent: boolean = !endEventId || message.flowNodeId === endEventId;
        if (isAwaitedEndEvent) {
          this._eventAggregator.unsubscribe(eventSubscription);
          resolve(message);
        }
      };

      eventSubscription = this._eventAggregator.subscribe(processEndMessageName, messageReceivedCallback);

      try {
        await this._executeProcess(identity, processInstanceConfig);
      } catch (error) {
        // Errors thrown by an ErrorEndEvent ("error.errorCode")
        // and @essential-project errors ("error.code") are thrown as they are.
        // Everything else is thrown as an InternalServerError.
        const isPresetError: boolean = (error.errorCode || error.code) && error.name;
        if (isPresetError) {
          return reject(error);
        }

        reject(new InternalServerError(error.message));
      }
    });
  }

  /**
   * Creates a Set of configurations for a new ProcessInstance.
   *
   * @param identity      The identity of the requesting user.
   * @param processModel  The ProcessModel for wich a new ProcessInstance is to
   *                      be created.
   * @param correlationId The CorrelationId in which the ProcessInstance
   *                      should run.
   *                      Will be generated, if not provided.
   * @param startEventId  The ID of the StartEvent by which to start the
   *                      ProcessInstance.
   * @param payload       The payload to pass to the ProcessInstance.
   * @param caller        If the ProcessInstance is a Subprocess or CallActivity,
   *                      this contains the ID of the calling ProcessInstance.
   * @returns             A set of configurations for the new ProcessInstance.
   *                      Contains a ProcessInstanceId, CorrelationId,
   *                      a ProcessToken,facades for the ProcessModel and
   *                      ProcessToken and the StartEvent that has the ID specified
   *                      in startEventId.
   */
  private _createProcessInstanceConfig(
    identity: IIdentity,
    processModel: Model.Types.Process,
    correlationId: string,
    startEventId: string,
    payload: any,
    caller: string,
  ): IProcessInstanceConfig {

    const processModelFacade: IProcessModelFacade = new ProcessModelFacade(processModel);

    const startEvent: Model.Events.StartEvent = processModelFacade.getStartEventById(startEventId);

    const processInstanceId: string = uuid.v4();

    if (!correlationId) {
      correlationId = uuid.v4();
    }

    if (payload === undefined || payload === null) {
      payload = {};
    }

    const processTokenFacade: IProcessTokenFacade = new ProcessTokenFacade(processInstanceId, processModel.id, correlationId, identity);

    const processToken: Runtime.Types.ProcessToken = processTokenFacade.createProcessToken(payload);
    processToken.caller = caller;
    processToken.payload = payload;

    const processInstanceConfig: IProcessInstanceConfig = {
      correlationId: correlationId,
      processModelId: processModel.id,
      processInstanceId: processInstanceId,
      parentProcessInstanceId: caller,
      processModelFacade: processModelFacade,
      startEvent: startEvent,
      processToken: processToken,
      processTokenFacade: processTokenFacade,
    };

    return processInstanceConfig;
  }

  /**
   * Handles the execution of a ProcessInstance and returns the End result.
   *
   * @async
   * @param   identity              The identity of the requesting user.
   * @param   processInstanceConfig The configs for the ProcessInstance.
   */
  private async _executeProcess(identity: IIdentity, processInstanceConfig: IProcessInstanceConfig): Promise<void> {

    try {
      await this._saveCorrelation(identity, processInstanceConfig);

      const startEventHandler: IFlowNodeHandler<Model.Base.FlowNode> =
        await this._flowNodeHandlerFactory.create(processInstanceConfig.startEvent);

      this._logProcessStarted(processInstanceConfig.correlationId, processInstanceConfig.processModelId, processInstanceConfig.processInstanceId);

      // Because of the usage of Promise-Chains, we only need to run the StartEvent and wait for the ProcessInstance to run its course.
      await startEventHandler.execute(
        processInstanceConfig.processToken,
        processInstanceConfig.processTokenFacade,
        processInstanceConfig.processModelFacade,
        identity,
      );

      const allResults: Array<IFlowNodeInstanceResult> = await processInstanceConfig.processTokenFacade.getAllResults();
      const resultToken: IFlowNodeInstanceResult = allResults.pop();

      this._logProcessFinished(processInstanceConfig.correlationId, processInstanceConfig.processModelId, processInstanceConfig.processInstanceId);
      this._sendProcessInstanceFinishedNotification(identity, processInstanceConfig, resultToken);

      await this._correlationService.finishCorrelation(identity, processInstanceConfig.correlationId);
    } catch (error) {
      this
        ._logProcessError(processInstanceConfig.correlationId, processInstanceConfig.processModelId, processInstanceConfig.processInstanceId, error);
      await this._correlationService.finishWithError(identity, processInstanceConfig.correlationId, error);
      throw error;
    }
  }

  /**
   * Creates a new entry in the database that links a ProcessInstance with a
   * Correlation.
   *
   * @async
   * @param   identity              The identity of the requesting user.
   * @param   processInstanceConfig The configs for the ProcessInstance.
   */
  private async _saveCorrelation(identity: IIdentity, processInstanceConfig: IProcessInstanceConfig): Promise<void> {

    const processDefinition: Runtime.Types.ProcessDefinitionFromRepository =
      await this._processModelService.getProcessDefinitionAsXmlByName(identity, processInstanceConfig.processModelId);

    await this._correlationService.createEntry(identity,
                                               processInstanceConfig.correlationId,
                                               processInstanceConfig.processInstanceId,
                                               processDefinition.name,
                                               processDefinition.hash,
                                               processInstanceConfig.parentProcessInstanceId);
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

  private _sendProcessInstanceFinishedNotification(
    identity: IIdentity,
    processInstanceConfig: IProcessInstanceConfig,
    resultToken: IFlowNodeInstanceResult,
  ): void {

    // Send notification about the finished ProcessInstance.
    const instanceFinishedEventName: string = eventAggregatorSettings.messagePaths.processInstanceEnded
      .replace(eventAggregatorSettings.messageParams.processInstanceId, processInstanceConfig.processInstanceId);

    const instanceFinishedMessage: ProcessEndedMessage = new ProcessEndedMessage(
      processInstanceConfig.correlationId,
      processInstanceConfig.processModelId,
      processInstanceConfig.processInstanceId,
      resultToken.flowNodeId,
      undefined, // TODO: Add FlowNodeInstanceId to final result token.
      identity,
      resultToken.result);

    this._eventAggregator.publish(instanceFinishedEventName, instanceFinishedMessage);
  }
}
