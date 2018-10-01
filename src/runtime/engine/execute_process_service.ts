import {Logger} from 'loggerhythm';
import * as moment from 'moment';
import * as uuid from 'uuid';

import {InternalServerError} from '@essential-projects/errors_ts';
import {IEventAggregator, ISubscription} from '@essential-projects/event_aggregator_contracts';
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
  IFlowNodeInstanceService,
  IProcessModelFacade,
  IProcessModelService,
  IProcessTokenFacade,
  IProcessTokenResult,
  Model,
  NextFlowNodeInfo,
  Runtime,
  TerminateEndEventReachedMessage,
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
  processInstanceId: string;
  processModelFacade: IProcessModelFacade;
  startEvent: Model.Events.StartEvent;
  processToken: Runtime.Types.ProcessToken;
  processTokenFacade: IProcessTokenFacade;
}

export class ExecuteProcessService implements IExecuteProcessService {

  private readonly _eventAggregator: IEventAggregator;
  private readonly _flowNodeHandlerFactory: IFlowNodeHandlerFactory;

  private readonly _flowNodeInstanceService: IFlowNodeInstanceService;
  private readonly _correlationService: ICorrelationService;
  private readonly _loggingApiService: ILoggingApi;
  private readonly _metricsApiService: IMetricsApi;
  private readonly _processModelService: IProcessModelService;

  private processTerminatedMessage: TerminateEndEventReachedMessage;

  constructor(correlationService: ICorrelationService,
              eventAggregator: IEventAggregator,
              flowNodeHandlerFactory: IFlowNodeHandlerFactory,
              flowNodeInstanceService: IFlowNodeInstanceService,
              loggingApiService: ILoggingApi,
              metricsApiService: IMetricsApi,
              processModelService: IProcessModelService) {

    this._correlationService = correlationService;
    this._eventAggregator = eventAggregator;
    this._flowNodeHandlerFactory = flowNodeHandlerFactory;
    this._flowNodeInstanceService = flowNodeInstanceService;
    this._loggingApiService = loggingApiService;
    this._metricsApiService = metricsApiService;
    this._processModelService = processModelService;
  }

  public async start(identity: IIdentity,
                     processModel: Model.Types.Process,
                     startEventId: string,
                     correlationId: string,
                     initialPayload?: any,
                     caller?: string): Promise<IProcessTokenResult> {

    const processInstanceConfig: IProcessInstanceConfig =
      this._createProcessInstanceConfig(identity, processModel, correlationId, startEventId, initialPayload, caller);

    try {

      this._logProcessStarted(processInstanceConfig.correlationId, processModel.id, processInstanceConfig.processInstanceId);
      const result: IProcessTokenResult = await this._executeProcess(identity, processModel, processInstanceConfig);
      this._logProcessFinished(processInstanceConfig.correlationId, processModel.id, processInstanceConfig.processInstanceId);

      return result;
    } catch (error) {
      this._logProcessError(processInstanceConfig.correlationId, processModel.id, processInstanceConfig.processInstanceId, error);
      throw error;
    }
  }

  public async startAndAwaitEndEvent(identity: IIdentity,
                                     processModel: Model.Types.Process,
                                     startEventId: string,
                                     correlationId: string,
                                     initialPayload?: any,
                                     caller?: string): Promise<EndEventReachedMessage> {

    return this._startAndAwaitEndEvent(identity, processModel, startEventId, correlationId, initialPayload, caller);
  }

  public async startAndAwaitSpecificEndEvent(identity: IIdentity,
                                             processModel: Model.Types.Process,
                                             startEventId: string,
                                             correlationId: string,
                                             endEventId: string,
                                             initialPayload?: any,
                                             caller?: string): Promise<EndEventReachedMessage> {

    return this._startAndAwaitEndEvent(identity, processModel, startEventId, correlationId, initialPayload, caller, endEventId);
  }

  private async _startAndAwaitEndEvent(identity: IIdentity,
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

      const processEndMessageName: string = eventAggregatorSettings.routePaths.endEventReached
        .replace(eventAggregatorSettings.routeParams.correlationId, processInstanceConfig.correlationId)
        .replace(eventAggregatorSettings.routeParams.processModelId, processModel.id);

      const messageReceivedCallback: Function = async(message: EndEventReachedMessage): Promise<void> => {
        const isAwaitedEndEvent: boolean = !endEventId || message.flowNodeId === endEventId;
        if (isAwaitedEndEvent) {
          resolve(message);
        }
      };

      const subscription: ISubscription = this._eventAggregator.subscribe(processEndMessageName, messageReceivedCallback);

      try {

        this._logProcessStarted(processInstanceConfig.correlationId, processModel.id, processInstanceConfig.processInstanceId);
        await this._executeProcess(identity, processModel, processInstanceConfig);
        this._logProcessFinished(processInstanceConfig.correlationId, processModel.id, processInstanceConfig.processInstanceId);

      } catch (error) {
        this._logProcessError(processInstanceConfig.correlationId, processModel.id, processInstanceConfig.processInstanceId, error);

        const subscriptionIsActive: boolean = subscription !== undefined;
        if (subscriptionIsActive) {
          subscription.dispose();
        }

        // If we received an error that was thrown by an ErrorEndEvent, pass on the error as it was received.
        // Otherwise, pass on an anonymous error.
        if (error.errorCode && error.name) {
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
  private _createProcessInstanceConfig(identity: IIdentity,
                                       processModel: Model.Types.Process,
                                       correlationId: string,
                                       startEventId: string,
                                       payload: any,
                                       caller: string): any {

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
    processTokenFacade.addResultForFlowNode(startEvent.id, payload);

    const processInstanceConfig: IProcessInstanceConfig = {
      correlationId: correlationId,
      processInstanceId: processInstanceId,
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
   * @param   processModel          The ProcessModel to start.
   * @param   processInstanceConfig The configs for the ProcessInstance.
   * @returns                       The ProcessInstance's result.
   */
  private async _executeProcess(identity: IIdentity,
                                processModel: Model.Types.Process,
                                processInstanceConfig: IProcessInstanceConfig): Promise<IProcessTokenResult> {

    const processTerminatedEvent: string = eventAggregatorSettings.routePaths.terminateEndEventReached
      .replace(eventAggregatorSettings.routeParams.processInstanceId, processInstanceConfig.processInstanceId);

    const processTerminationSubscription: ISubscription = this._eventAggregator
      .subscribeOnce(processTerminatedEvent, async(message: TerminateEndEventReachedMessage): Promise<void> => {
        this.processTerminatedMessage = message;
      });

    await this._saveCorrelation(identity, processInstanceConfig.correlationId, processInstanceConfig.processInstanceId, processModel.id);

    await this._executeFlowNode(processInstanceConfig.startEvent,
                                processInstanceConfig.processToken,
                                processInstanceConfig.processTokenFacade,
                                processInstanceConfig.processModelFacade,
                                identity);

    const resultToken: IProcessTokenResult = await this._getFinalResult(processInstanceConfig.processTokenFacade);

    const processTerminationSubscriptionIsActive: boolean = processTerminationSubscription !== undefined;
    if (processTerminationSubscriptionIsActive) {
      processTerminationSubscription.dispose();
    }

    return resultToken;
  }

  /**
   * Creates a new entry in the database that links a ProcessInstance with a
   * Correlation.
   *
   * @async
   * @param identity          The identity of the user that started the
   *                          ProcessInstance.
   * @param correlationId     The ID of the Correlation.
   * @param processInstanceId The ID of the ProcessInstance.
   * @param processModelId    The ID of the ProcessModel.
   */
  private async _saveCorrelation(identity: IIdentity,
                                 correlationId: string,
                                 processInstanceId: string,
                                 processModelId: string,
                                ): Promise<void> {

    const processDefinition: Runtime.Types.ProcessDefinitionFromRepository =
      await this._processModelService.getProcessDefinitionAsXmlByName(identity, processModelId);

    await this
      ._correlationService
      .createEntry(identity, correlationId, processInstanceId, processDefinition.name, processDefinition.hash);
  }

  /**
   * Handles the execution of each FlowNode in the given ProcessInstance.
   *
   * @async
   * @param flowNode           The FlowNode to run next.
   * @param processToken       The current ProcessToken.
   * @param processTokenFacade The Facade for the current ProcessToken.
   * @param processModelFacade The Facade for the ProcessModel that describes
   *                           the running ProcessInstance.
   * @param identity           The Identity of the user that started the
   *                           ProcessInstance.
   * @param terminationMessage Optional: Contains a message from a TerminateEndEvent.
   *                           If set, this will cause the ProcessInstance to exit
   *                           immediately.
   * @throws                   500, if the ProcessInstance was interrupted
   *                           prematurely by a TerminateEndEvent.
   */
  private async _executeFlowNode(flowNode: Model.Base.FlowNode,
                                 processToken: Runtime.Types.ProcessToken,
                                 processTokenFacade: IProcessTokenFacade,
                                 processModelFacade: IProcessModelFacade,
                                 identity: IIdentity,
                                ): Promise<void> {

    const flowNodeHandler: IFlowNodeHandler<Model.Base.FlowNode> = await this._flowNodeHandlerFactory.create(flowNode, processModelFacade);

    const nextFlowNodeInfo: NextFlowNodeInfo =
      await flowNodeHandler.execute(flowNode, processToken, processTokenFacade, processModelFacade, identity);

    const nextFlowNodeInfoHasFlowNode: boolean = nextFlowNodeInfo.flowNode !== undefined;

    const processWasTerminated: boolean = this.processTerminatedMessage !== undefined;

    if (processWasTerminated) {
      const flowNodeInstanceId: string = flowNodeHandler.getInstanceId();
      await this._flowNodeInstanceService.persistOnTerminate(flowNode.id, flowNodeInstanceId, processToken);

      const error: InternalServerError =
        new InternalServerError(`Process was terminated through TerminateEndEvent "${this.processTerminatedMessage.flowNodeId}."`);

      throw error;
    } else if (nextFlowNodeInfoHasFlowNode) {
      await this._executeFlowNode(nextFlowNodeInfo.flowNode,
                                  nextFlowNodeInfo.token,
                                  nextFlowNodeInfo.processTokenFacade,
                                  processModelFacade,
                                  identity);
    }
  }

  /**
   * Writes logs and metrics at the beginning of a ProcessInstance's execution.
   *
   * @param correlationId     The ID of the Correlation the ProcessInstance
   *                          belongs to.
   * @param processModelId    The ID of the ProcessModel describing the
   *                          ProcessInstance.
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
   * @param correlationId     The ID of the Correlation the ProcessInstance
   *                          belongs to.
   * @param processModelId    The ID of the ProcessModel describing the
   *                          ProcessInstance.
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
   * @param correlationId     The ID of the Correlation the ProcessInstance
   *                          belongs to.
   * @param processModelId    The ID of the ProcessModel describing the
   *                          ProcessInstance.
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

  /**
   * Gets the final result from the given ProcessTokenFacade.
   *
   * @param   processTokenFacade The facade containing the full ProcessToken.
   * @returns                    The final result stored in the ProcessTokenFacade.
   */
  private async _getFinalResult(processTokenFacade: IProcessTokenFacade): Promise<IProcessTokenResult> {

    const allResults: Array<IProcessTokenResult> = await processTokenFacade.getAllResults();

    return allResults.pop();
  }
}
