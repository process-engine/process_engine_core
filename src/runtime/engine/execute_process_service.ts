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

const logger: Logger = Logger.createLogger('processengine:execute_process_service');

export class ExecuteProcessService implements IExecuteProcessService {

  private eventAggregator: IEventAggregator;
  private flowNodeHandlerFactory: IFlowNodeHandlerFactory;

  private flowNodeInstanceService: IFlowNodeInstanceService;
  private correlationService: ICorrelationService;
  private loggingApiService: ILoggingApi;
  private metricsApiService: IMetricsApi;
  private processModelService: IProcessModelService;

  private processWasTerminated: boolean = false;
  private processTerminationMessage: TerminateEndEventReachedMessage;

  constructor(correlationService: ICorrelationService,
              eventAggregator: IEventAggregator,
              flowNodeHandlerFactory: IFlowNodeHandlerFactory,
              flowNodeInstanceService: IFlowNodeInstanceService,
              loggingApiService: ILoggingApi,
              metricsApiService: IMetricsApi,
              processModelService: IProcessModelService) {

    this.correlationService = correlationService;
    this.eventAggregator = eventAggregator;
    this.flowNodeHandlerFactory = flowNodeHandlerFactory;
    this.flowNodeInstanceService = flowNodeInstanceService;
    this.loggingApiService = loggingApiService;
    this.metricsApiService = metricsApiService;
    this.processModelService = processModelService;
  }

  public async start(identity: IIdentity,
                     processModel: Model.Types.Process,
                     startEventId: string,
                     correlationId: string,
                     initialPayload?: any,
                     caller?: string): Promise<IProcessTokenResult> {

    const processModelFacade: IProcessModelFacade = new ProcessModelFacade(processModel);

    const startEvent: Model.Events.StartEvent = processModelFacade.getStartEventById(startEventId);

    const processInstanceId: string = uuid.v4();

    if (!correlationId) {
      correlationId = uuid.v4();
    }

    if (initialPayload === undefined || initialPayload === null) {
      initialPayload = {};
    }

    const processTokenFacade: IProcessTokenFacade = new ProcessTokenFacade(processInstanceId, processModel.id, correlationId, identity);

    const processToken: Runtime.Types.ProcessToken = processTokenFacade.createProcessToken(initialPayload);
    processToken.caller = caller;
    processTokenFacade.addResultForFlowNode(startEvent.id, initialPayload);

    const processTerminationSubscription: ISubscription = this._createProcessTerminationSubscription(processInstanceId);

    await this._saveCorrelation(identity, processInstanceId, correlationId, processModel.id);

    const startTime: moment.Moment = moment.utc();
    this.loggingApiService.writeLogForProcessModel(correlationId, processModel.id, processInstanceId, LogLevel.info, `Process instance started.`);
    this.metricsApiService.writeOnProcessStarted(correlationId, processModel.id, startTime);

    try {
      await this._executeFlowNode(startEvent, processToken, processTokenFacade, processModelFacade, identity);

      const endTime: moment.Moment = moment.utc();

      this
        .loggingApiService
        .writeLogForProcessModel(correlationId, processModel.id, processInstanceId, LogLevel.info, `Process instance finished.`);
      this.metricsApiService.writeOnProcessFinished(correlationId, processModel.id, endTime);

      const resultToken: IProcessTokenResult = await this._getFinalResult(processTokenFacade);

      const processTerminationSubscriptionIsActive: boolean = processTerminationSubscription !== undefined;
      if (processTerminationSubscriptionIsActive) {
        processTerminationSubscription.dispose();
      }

      if (this.processWasTerminated) {
        const message: string = `Process was terminated through TerminateEndEvent "${this.processTerminationMessage.eventId}."`;
        this
          .loggingApiService
          .writeLogForProcessModel(correlationId, processModel.id, processInstanceId, LogLevel.error, message);

        throw new InternalServerError(message);
      }

      return resultToken;
    } catch (error) {
      const errorTime: moment.Moment = moment.utc();
      this
        .loggingApiService
        .writeLogForProcessModel(correlationId, processModel.id, processInstanceId, LogLevel.error, error.message);
      this.metricsApiService.writeOnProcessError(correlationId, processModel.id, error, errorTime);

      throw error;
    }

  }

  public async startAndAwaitSpecificEndEvent(identity: IIdentity,
                                             processModel: Model.Types.Process,
                                             startEventId: string,
                                             correlationId: string,
                                             endEventId: string,
                                             initialPayload?: any,
                                             caller?: string): Promise<EndEventReachedMessage> {

    return new Promise<EndEventReachedMessage>(async(resolve: Function, reject: Function): Promise<void> => {

      if (!correlationId) {
        correlationId = uuid.v4();
      }

      const subscriptionName: string = `/processengine/correlation/${correlationId}/process/${processModel.id}/node/${endEventId}`;

      const subscription: ISubscription =
        this.eventAggregator.subscribeOnce(subscriptionName, async(message: EndEventReachedMessage): Promise<void> => {
          resolve(message);
        });

      try {
        await this.start(identity, processModel, startEventId, correlationId, initialPayload, caller);
      } catch (error) {
        const errorLogMessage: string =
          `An error occured while trying to execute process model with id "${processModel.id}" in correlation "${correlationId}".`;
        logger.error(errorLogMessage, error);

        const subscriptionIsActive: boolean = subscription !== undefined;
        if (subscriptionIsActive) {
          subscription.dispose();
        }
        const errorTime: moment.Moment = moment.utc();
        this.metricsApiService.writeOnProcessError(correlationId, processModel.id, error, errorTime);

        // If we received an error that was thrown by an ErrorEndEvent, pass on the error as it was received.
        // Otherwise, pass on an anonymous error.
        if (error.errorCode && error.name) {
          return reject(error);
        }

        reject(new InternalServerError(error.message));
      }
    });
  }

  public async startAndAwaitEndEvent(identity: IIdentity,
                                     processModel: Model.Types.Process,
                                     startEventId: string,
                                     correlationId: string,
                                     initialPayload?: any,
                                     caller?: string): Promise<EndEventReachedMessage> {

    const processModelFacade: IProcessModelFacade = new ProcessModelFacade(processModel);

    const endEvents: Array<Model.Events.EndEvent> = processModelFacade.getEndEvents();
    const subscriptions: Array<ISubscription> = [];

    return new Promise<EndEventReachedMessage>(async(resolve: Function, reject: Function): Promise<void> => {

      if (!correlationId) {
        correlationId = uuid.v4();
      }

      for (const endEvent of endEvents) {

        const subscriptionName: string = `/processengine/correlation/${correlationId}/process/${processModel.id}/node/${endEvent.id}`;

        const subscription: ISubscription =
          this.eventAggregator.subscribeOnce(subscriptionName, async(message: EndEventReachedMessage): Promise<void> => {

          for (const existingSubscription of subscriptions) {
            existingSubscription.dispose();
          }

          resolve(message);
        });

        subscriptions.push(subscription);
      }

      try {
        await this.start(identity, processModel, startEventId, correlationId, initialPayload, caller);
      } catch (error) {
        const errorLogMessage: string =
          `An error occured while trying to execute process model with id "${processModel.id}" in correlation "${correlationId}".`;
        logger.error(errorLogMessage, error);

        for (const subscription of subscriptions) {
          subscription.dispose();
        }
        const errorTime: moment.Moment = moment.utc();
        this.metricsApiService.writeOnProcessError(correlationId, processModel.id, error, errorTime);

        // If we received an error that was thrown by an ErrorEndEvent, pass on the error as it was received.
        // Otherwise, pass on an anonymous error.
        if (error.errorCode && error.name) {
          return reject(error);
        }

        reject(new InternalServerError(error.message));
      }

    });
  }

  private async _saveCorrelation(identity: IIdentity,
                                 correlationId: string,
                                 processInstanceId: string,
                                 processModelId: string,
                                ): Promise<void> {

    const processDefinition: Runtime.Types.ProcessDefinitionFromRepository =
      await this.processModelService.getProcessDefinitionAsXmlByName(identity, processModelId);

    await this.correlationService.createEntry(correlationId, processInstanceId, processDefinition.name, processDefinition.hash);
  }

  private _createProcessTerminationSubscription(processInstanceId: string): ISubscription {

    // Branch execution must not continue, if the process was terminated.
    // So we need to watch out for a terminate end event here aswell.
    const eventName: string = `/processengine/process/${processInstanceId}/terminated`;

    return this
        .eventAggregator
        .subscribeOnce(eventName, async(message: TerminateEndEventReachedMessage): Promise<void> => {
          this.processWasTerminated = true;
          this.processTerminationMessage = message;
      });
  }

  private async _executeFlowNode(flowNode: Model.Base.FlowNode,
                                 processToken: Runtime.Types.ProcessToken,
                                 processTokenFacade: IProcessTokenFacade,
                                 processModelFacade: IProcessModelFacade,
                                 identity: IIdentity): Promise<void> {

    const flowNodeHandler: IFlowNodeHandler<Model.Base.FlowNode> = await this.flowNodeHandlerFactory.create(flowNode, processModelFacade);

    const nextFlowNodeInfo: NextFlowNodeInfo =
      await flowNodeHandler.execute(flowNode, processToken, processTokenFacade, processModelFacade, identity);

    const nextFlowNodeInfoHasFlowNode: boolean = nextFlowNodeInfo.flowNode !== undefined;

    if (this.processWasTerminated) {
      const flowNodeInstanceId: string = flowNodeHandler.getInstanceId();
      await this.flowNodeInstanceService.persistOnTerminate(flowNode.id, flowNodeInstanceId, processToken);
    } else if (nextFlowNodeInfoHasFlowNode) {
      await this._executeFlowNode(nextFlowNodeInfo.flowNode,
                                  nextFlowNodeInfo.token,
                                  nextFlowNodeInfo.processTokenFacade,
                                  processModelFacade,
                                  identity);
    }
  }

  private async _getFinalResult(processTokenFacade: IProcessTokenFacade): Promise<IProcessTokenResult> {

    const allResults: Array<IProcessTokenResult> = await processTokenFacade.getAllResults();

    return allResults.pop();
  }

}
