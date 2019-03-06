import {Logger} from 'loggerhythm';
import * as moment from 'moment';

import {InternalServerError} from '@essential-projects/errors_ts';
import {EventReceivedCallback, IEventAggregator, Subscription} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';

import {Correlation, CorrelationProcessInstance, ICorrelationService} from '@process-engine/correlation.contracts';
import {
  FlowNodeInstance,
  FlowNodeInstanceState,
  IFlowNodeInstanceService,
  ProcessToken,
  ProcessTokenType,
} from '@process-engine/flow_node_instance.contracts';
import {ILoggingApi, LogLevel} from '@process-engine/logging_api_contracts';
import {IMetricsApi} from '@process-engine/metrics_api_contracts';
import {
  EndEventReachedMessage,
  eventAggregatorSettings,
  IFlowNodeHandler,
  IFlowNodeHandlerFactory,
  IFlowNodeInstanceResult,
  IModelParser,
  IProcessModelFacade,
  IProcessTokenFacade,
  IResumeProcessService,
  ProcessEndedMessage,
} from '@process-engine/process_engine_contracts';
import {BpmnType, Model} from '@process-engine/process_model.contracts';

import {ProcessModelFacade} from './process_model_facade';
import {ProcessTokenFacade} from './process_token_facade';

const logger: Logger = new Logger('processengine:runtime:resume_process_service');

interface IProcessInstanceModelAssociation {
  processModelId: string;
  processInstanceId: string;
  processInstanceOwner: IIdentity;
}

interface IProcessInstanceConfig {
  correlationId: string;
  processModelId: string;
  processInstanceId: string;
  processModelFacade: IProcessModelFacade;
  startEvent: Model.Events.StartEvent;
  startEventInstance: FlowNodeInstance;
  processToken: ProcessToken;
  processTokenFacade: IProcessTokenFacade;
}

/**
 * This service is designed to find and resume ProcessInstances that were
 * interrupted during a previous lifecycle of the ProcessEngine.
 *
 * It is strongly encouraged to only run this service ONCE when starting up
 * the ProcessEngine!
 *
 * Trying to resume ProcessInstances during normal operation will have
 * unpredictable consequences!
 */
export class ResumeProcessService implements IResumeProcessService {

  private readonly _bpmnModelParser: IModelParser;
  private readonly _correlationService: ICorrelationService;
  private readonly _eventAggregator: IEventAggregator;
  private readonly _flowNodeHandlerFactory: IFlowNodeHandlerFactory;
  private readonly _flowNodeInstanceService: IFlowNodeInstanceService;
  private readonly _loggingApiService: ILoggingApi;
  private readonly _metricsApiService: IMetricsApi;

  constructor(
    bpmnModelParser: IModelParser,
    correlationService: ICorrelationService,
    eventAggregator: IEventAggregator,
    flowNodeHandlerFactory: IFlowNodeHandlerFactory,
    flowNodeInstanceService: IFlowNodeInstanceService,
    loggingApiService: ILoggingApi,
    metricsApiService: IMetricsApi,
  ) {
    this._bpmnModelParser = bpmnModelParser;
    this._correlationService = correlationService;
    this._eventAggregator = eventAggregator,
    this._flowNodeHandlerFactory = flowNodeHandlerFactory;
    this._flowNodeInstanceService = flowNodeInstanceService;
    this._loggingApiService = loggingApiService;
    this._metricsApiService = metricsApiService;
  }

  public async findAndResumeInterruptedProcessInstances(identity: IIdentity): Promise<void> {

    logger.info('Resuming ProcessInstances that were not yet finished.');

    // First get all active FlowNodeInstances from every ProcessInstance.
    const activeFlowNodeInstances: Array<FlowNodeInstance> =
      await this._flowNodeInstanceService.queryActive();

    // Now get the unique ProcessInstanceIds and ProcessModelIds from the list.
    const activeProcessInstances: Array<IProcessInstanceModelAssociation> =
      this._findProcessInstancesFromFlowNodeList(activeFlowNodeInstances);

    logger.verbose(`Found ${activeProcessInstances.length} ProcessInstances to resume.`);

    for (const processInstance of activeProcessInstances) {
      // Do not await this, to avoid possible issues with Inter-Process communication.
      //
      // Lets say, Process A sends signals/messages to Process B,
      // then these processes must run in concert, not sequentially.
      this.resumeProcessInstanceById(processInstance.processInstanceOwner, processInstance.processModelId, processInstance.processInstanceId);
    }
  }

  public async resumeProcessInstanceById(identity: IIdentity, processModelId: string, processInstanceId: string): Promise<EndEventReachedMessage> {

    logger.info(`Attempting to resume ProcessInstance with instance ID ${processInstanceId} and model ID ${processModelId}`);

    const flowNodeInstancesForProcessInstance: Array<FlowNodeInstance> =
      await this._flowNodeInstanceService.queryByProcessInstance(processInstanceId);

    // ----
    // First check if there even are any FlowNodeInstances still active for the ProcessInstance.
    // There is no point in trying to resume anything that's already finished.
    const processHasActiveFlowNodeInstances: boolean =
      flowNodeInstancesForProcessInstance.some((entry: FlowNodeInstance): boolean => {
        return entry.state === FlowNodeInstanceState.running ||
               entry.state === FlowNodeInstanceState.suspended;
      });

    if (!processHasActiveFlowNodeInstances) {
      logger.info(`ProcessInstance ${processInstanceId} is not active anymore.`);

      return;
    }

    return new Promise<EndEventReachedMessage>(async(resolve: Function, reject: Function): Promise<void> => {

      try {
        const processInstanceConfig: IProcessInstanceConfig =
          await this._createProcessInstanceConfig(identity, processInstanceId, flowNodeInstancesForProcessInstance);

        const processEndMessageName: string = eventAggregatorSettings.messagePaths.endEventReached
          .replace(eventAggregatorSettings.messageParams.correlationId, processInstanceConfig.correlationId)
          .replace(eventAggregatorSettings.messageParams.processModelId, processModelId);

        let eventSubscription: Subscription;

        const messageReceivedCallback: EventReceivedCallback = async(message: EndEventReachedMessage): Promise<void> => {
          this._eventAggregator.unsubscribe(eventSubscription);
          resolve(message);
        };

        eventSubscription = this._eventAggregator.subscribe(processEndMessageName, messageReceivedCallback);

        await this._resumeProcessInstance(identity, processInstanceConfig, flowNodeInstancesForProcessInstance);
      } catch (error) {
        // Errors from @essential-project and ErrorEndEvents are thrown as they are.
        // Everything else is thrown as an InternalServerError.
        const isPresetError: boolean = error.code && error.name;
        if (isPresetError) {
          return reject(error);
        }

        reject(new InternalServerError(error.message));
      }
    });
  }

  private async _createProcessInstanceConfig(
    identity: IIdentity,
    processInstanceId: string,
    flowNodeInstances: Array<FlowNodeInstance>,
  ): Promise<IProcessInstanceConfig> {

    const correlation: Correlation = await this._correlationService.getByProcessInstanceId(identity, processInstanceId);

    const processModelCorrelation: CorrelationProcessInstance = correlation.processModels[0];

    const processModelDefinitions: Model.Definitions = await this._bpmnModelParser.parseXmlToObjectModel(processModelCorrelation.xml);
    const processModel: Model.Process = processModelDefinitions.processes[0];
    const processModelFacade: IProcessModelFacade = new ProcessModelFacade(processModel);

    // Find the StartEvent the ProcessInstance was started with.
    const startEventInstance: FlowNodeInstance =
      flowNodeInstances.find((instance: FlowNodeInstance): boolean => {
        return instance.flowNodeType === BpmnType.startEvent;
      });

    const startEvent: Model.Events.StartEvent = processModelFacade.getStartEventById(startEventInstance.flowNodeId);

    // The initial ProcessToken will always be the payload that the StartEvent first received.
    const initialToken: ProcessToken =
      startEventInstance.tokens.find((token: ProcessToken): boolean => {
        return token.type === ProcessTokenType.onEnter;
      });

    const processTokenFacade: IProcessTokenFacade =
      new ProcessTokenFacade(processInstanceId, processModel.id, startEventInstance.correlationId, identity);

    const processToken: ProcessToken = processTokenFacade.createProcessToken(initialToken.payload);
    processToken.payload = initialToken.payload;

    const processInstanceConfig: IProcessInstanceConfig = {
      correlationId: startEventInstance.correlationId,
      processModelId: processModel.id,
      processInstanceId: processInstanceId,
      processModelFacade: processModelFacade,
      startEvent: startEvent,
      startEventInstance: startEventInstance,
      processToken: processToken,
      processTokenFacade: processTokenFacade,
    };

    return processInstanceConfig;
  }

  private async _resumeProcessInstance(
    identity: IIdentity,
    processInstanceConfig: IProcessInstanceConfig,
    flowNodeInstances: Array<FlowNodeInstance>,
  ): Promise<void> {

    const {correlationId, processInstanceId, processModelId} = processInstanceConfig;

    try {
      // Resume the ProcessInstance from the StartEvent it was originally started with.
      // The ProcessInstance will retrace all its steps until it ends up at the FlowNode it was interrupted at.
      // This removes the need for us to reconstruct the ProcessToken manually, or trace any parallel running branches,
      // because the FlowNodeHandlers will do that for us.
      // When we reached the interrupted FlowNodeInstance and finished resuming it, the ProcessInstance will
      // continue to run normally; i.e. all following FlowNodes will be 'executed' and no longer 'resumed'.
      this._logProcessResumed(correlationId, processModelId, processInstanceId);

      const flowNodeHandler: IFlowNodeHandler<Model.Base.FlowNode> =
        await this._flowNodeHandlerFactory.create(processInstanceConfig.startEvent);

      await flowNodeHandler.resume(
        flowNodeInstances,
        processInstanceConfig.processTokenFacade,
        processInstanceConfig.processModelFacade,
        identity,
      );

      const allResults: Array<IFlowNodeInstanceResult> = await processInstanceConfig.processTokenFacade.getAllResults();
      const resultToken: IFlowNodeInstanceResult = allResults.pop();

      const terminateEvent: string = eventAggregatorSettings.messagePaths.terminateEndEventReached
        .replace(eventAggregatorSettings.messageParams.processInstanceId, processInstanceConfig.processInstanceId);

      this._eventAggregator.subscribeOnce(terminateEvent, async() => {
        const terminateError: InternalServerError = new InternalServerError('Process was terminated!');

        await this
          ._correlationService
          .finishProcessInstanceInCorrelationWithError(identity,
                                                      processInstanceConfig.correlationId,
                                                      processInstanceConfig.processInstanceId,
                                                      terminateError);

        this
          ._logProcessError(processInstanceConfig.correlationId,
                            processInstanceConfig.processModelId,
                            processInstanceConfig.processInstanceId,
                            terminateError);

        return;
      });

      this._logProcessFinished(correlationId, processModelId, processInstanceId);

      await this
        ._correlationService
        .finishProcessInstanceInCorrelation(identity, correlationId, processInstanceId);

      this._sendProcessInstanceFinishedNotification(identity, processInstanceConfig, resultToken);

    } catch (error) {
      this._logProcessError(correlationId, processModelId, processInstanceId, error);

      await this
        ._correlationService
        .finishProcessInstanceInCorrelationWithError(identity, correlationId, processInstanceId, error);

      throw error;
    }
  }

  /**
   * Takes a list of FlowNodeInstances and picks out the unique ProcessModelIds
   * and ProcessInstanceIds from each.
   *
   * Each Id is only stored once, to account for ProcessInstances with parallel
   * running branches.
   *
   * Also, Subprocesses must be filtered out, because these are always handled
   * by a CallActivityHandler or SubProcessHandler.
   *
   * @param   activeFlowNodeInstances The list of FlowNodeInstances from which
   *                                  to get a list of ProcessInstances.
   * @returns                         The list of ProcessInstances.
   */
  private _findProcessInstancesFromFlowNodeList(
    activeFlowNodeInstances: Array<FlowNodeInstance>,
  ): Array<IProcessInstanceModelAssociation> {

    const activeProcessInstances: Array<IProcessInstanceModelAssociation> = [];

    for (const flowNodeInstance of activeFlowNodeInstances) {
      // Store each processInstanceId and processModelId only once,
      // to account for processes with ParallelGateways.
      const processInstanceListHasNoMatchingEntry: boolean =
        !activeProcessInstances.some((entry: IProcessInstanceModelAssociation): boolean => {
          return entry.processInstanceId === flowNodeInstance.processInstanceId;
        });
      const flowNodeInstanceIsNotPartOfSubprocess: boolean = !flowNodeInstance.parentProcessInstanceId;

      if (processInstanceListHasNoMatchingEntry && flowNodeInstanceIsNotPartOfSubprocess) {
        const newAssociation: IProcessInstanceModelAssociation = {
          processInstanceId: flowNodeInstance.processInstanceId,
          processModelId: flowNodeInstance.processModelId,
          processInstanceOwner: flowNodeInstance.owner,
        };
        activeProcessInstances.push(newAssociation);
      }
    }

    return activeProcessInstances;
  }

  /**
   * Writes logs and metrics at the beginning of a ProcessInstance's resumption.
   *
   * @param correlationId     The ProcessInstance's CorrelationId.
   * @param processModelId    The ProcessInstance's ProcessModelId.
   * @param processInstanceId The ID of the ProcessInstance.
   */
  private _logProcessResumed(correlationId: string, processModelId: string, processInstanceId: string): void {

    logger.info(`ProcessInstance with instance ID ${processInstanceId} and model ID ${processModelId} successfully resumed.`);
    const startTime: moment.Moment = moment.utc();
    this._metricsApiService.writeOnProcessStarted(correlationId, processModelId, startTime);
    this._loggingApiService.writeLogForProcessModel(correlationId,
                                                    processModelId,
                                                    processInstanceId,
                                                    LogLevel.info,
                                                    `ProcessInstance resumed.`,
                                                    startTime.toDate());
  }

  /**
   * Writes logs and metrics after a ProcessInstance finishes execution.
   *
   * @param correlationId     The ProcessInstance's CorrelationId.
   * @param processModelId    The ProcessInstance's ProcessModelId.
   * @param processInstanceId The ID of the ProcessInstance.
   */
  private _logProcessFinished(correlationId: string, processModelId: string, processInstanceId: string): void {

    logger.info(`ProcessInstance with instance ID ${processInstanceId} and model ID ${processModelId} successfully finished.`);

    const endTime: moment.Moment = moment.utc();
    this._metricsApiService.writeOnProcessFinished(correlationId, processModelId, endTime);
    this._loggingApiService.writeLogForProcessModel(correlationId,
                                                    processModelId,
                                                    processInstanceId,
                                                    LogLevel.info,
                                                    `ProcessInstance finished.`,
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

    logger.error(`ProcessInstance with instance ID ${processInstanceId} and model ID ${processModelId} failed with error.`, error);
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
      resultToken.flowNodeInstanceId,
      identity,
      resultToken.result);

    this._eventAggregator.publish(instanceFinishedEventName, instanceFinishedMessage);
  }
}
