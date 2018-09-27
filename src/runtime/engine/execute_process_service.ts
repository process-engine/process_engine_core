import {Logger} from 'loggerhythm';
import * as moment from 'moment';
import * as uuid from 'uuid';

import {InternalServerError} from '@essential-projects/errors_ts';
import {IEventAggregator, ISubscription} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';

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

const logger: Logger = Logger.createLogger('processengine:execute_process_service');

interface IProcessStateInfo {
  processTerminationSubscription?: ISubscription;
  processTerminatedMessage?: TerminateEndEventReachedMessage;
}

export class ExecuteProcessService implements IExecuteProcessService {

  private _eventAggregator: IEventAggregator;
  private _flowNodeHandlerFactory: IFlowNodeHandlerFactory;

  private _flowNodeInstanceService: IFlowNodeInstanceService;
  private _correlationService: ICorrelationService;
  private _metricsService: IMetricsApi;
  private _processModelService: IProcessModelService;

  // TODO: CAUTION! this is just a workaround to be able to subscribe to the new
  // messages routes without having to refactor all the startProcess methods in
  // this service! Please get rid of this class variable ASAP.
  private _processInstanceId: string;

  constructor(correlationService: ICorrelationService,
              eventAggregator: IEventAggregator,
              flowNodeHandlerFactory: IFlowNodeHandlerFactory,
              flowNodeInstanceService: IFlowNodeInstanceService,
              metricsService: IMetricsApi,
              processModelService: IProcessModelService) {

    this._correlationService = correlationService;
    this._eventAggregator = eventAggregator;
    this._flowNodeHandlerFactory = flowNodeHandlerFactory;
    this._flowNodeInstanceService = flowNodeInstanceService;
    this._metricsService = metricsService;
    this._processModelService = processModelService;
  }

  private get correlationService(): ICorrelationService {
    return this._correlationService;
  }

  private get eventAggregator(): IEventAggregator {
    return this._eventAggregator;
  }

  private get flowNodeHandlerFactory(): IFlowNodeHandlerFactory {
    return this._flowNodeHandlerFactory;
  }

  private get flowNodeInstanceService(): IFlowNodeInstanceService {
    return this._flowNodeInstanceService;
  }

  private get metricsService(): IMetricsApi {
    return this._metricsService;
  }

  private get processModelService(): IProcessModelService {
    return this._processModelService;
  }

  private _getProcessInstanceId(): string {
    if (!this._processInstanceId) {
      this._processInstanceId = uuid.v4();
    }

    return this._processInstanceId;
  }

  public async start(identity: IIdentity,
                     processModel: Model.Types.Process,
                     startEventId: string,
                     correlationId: string,
                     initialPayload?: any,
                     caller?: string): Promise<IProcessTokenResult> {

    const processModelFacade: IProcessModelFacade = new ProcessModelFacade(processModel);

    const startEvent: Model.Events.StartEvent = processModelFacade.getStartEventById(startEventId);

    const processInstanceId: string = this._getProcessInstanceId();

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

    const processStateInfo: IProcessStateInfo = {};

    const processTerminatedEvent: string = eventAggregatorSettings.routePaths.terminateEndEventReached
      .replace(eventAggregatorSettings.routeParams.processInstanceId, processInstanceId);

    const processTerminationSubscription: ISubscription = this.eventAggregator
      .subscribe(processTerminatedEvent, async(message: TerminateEndEventReachedMessage): Promise<void> => {
          processStateInfo.processTerminatedMessage = message;
      });

    await this._saveCorrelation(identity, correlationId, processModel);

    const startTime: moment.Moment = moment.utc();
    this.metricsService.writeOnProcessStarted(correlationId, processModel.id, startTime);
    try {
      await this._executeFlowNode(startEvent, processToken, processTokenFacade, processModelFacade, identity, processStateInfo);

      const endTime: moment.Moment = moment.utc();
      this.metricsService.writeOnProcessFinished(correlationId, processModel.id, endTime);
      const resultToken: IProcessTokenResult = await this._getFinalResult(processTokenFacade);

      const processTerminationSubscriptionIsActive: boolean = processTerminationSubscription !== undefined;
      if (processTerminationSubscriptionIsActive) {
        processTerminationSubscription.dispose();
      }

      const processWasTerminated: boolean = processStateInfo.processTerminatedMessage !== undefined;

      if (processWasTerminated) {
        throw new InternalServerError(`Process was terminated through TerminateEndEvent "${processStateInfo.processTerminatedMessage.flowNodeId}."`);
      }

      return resultToken;
    } catch (error) {
      const errorTime: moment.Moment = moment.utc();
      this.metricsService.writeOnProcessError(correlationId, processModel.id, error, errorTime);
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

      const processInstanceId: string = this._getProcessInstanceId();

      const processEndEvent: string = eventAggregatorSettings.routePaths.endEventReached
        .replace(eventAggregatorSettings.routeParams.processInstanceId, processInstanceId);

      const subscription: ISubscription =
        this.eventAggregator.subscribe(processEndEvent,
          async(message: EndEventReachedMessage): Promise<void> => {
            const isAwaitedEndEvent: boolean = message.flowNodeId === endEventId;
            if (isAwaitedEndEvent) {
              resolve(message);
            }
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
        this.metricsService.writeOnProcessError(correlationId, processModel.id, error, errorTime);

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

    if (!correlationId) {
      correlationId = uuid.v4();
    }

    const processInstanceId: string = this._getProcessInstanceId();

    // We need to match the event by the processInstanceId, rather than the processModelId, because
    // the ProcessInstanceId is the only truly unique id we have.
    // const subscriptionName: string = `/processengine/correlation/${correlationId}/process/${processModel.id}/node/${endEvent.id}`;

    return new Promise<EndEventReachedMessage>(async(resolve: Function, reject: Function): Promise<void> => {

      const processEndEvent: string = eventAggregatorSettings.routePaths.endEventReached
        .replace(eventAggregatorSettings.routeParams.processInstanceId, processInstanceId);

      const subscription: ISubscription =
        this.eventAggregator.subscribeOnce(processEndEvent,
          async(message: EndEventReachedMessage): Promise<void> => {
            resolve(message);
          });

      try {
        await this.start(identity, processModel, startEventId, correlationId, initialPayload, caller);
      } catch (error) {
        const errorLogMessage: string =
          `An error occured while trying to execute process model with id "${processModel.id}" in correlation "${correlationId}".`;
        logger.error(errorLogMessage, error);

        subscription.dispose();

        const errorTime: moment.Moment = moment.utc();
        this.metricsService.writeOnProcessError(correlationId, processModel.id, error, errorTime);

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
                                 processModel: Model.Types.Process,
                                ): Promise<void> {

    const processDefinition: Runtime.Types.ProcessDefinitionFromRepository =
      await this.processModelService.getProcessDefinitionAsXmlByName(identity, processModel.id);

    await this.correlationService.createEntry(correlationId, processDefinition.hash);
  }

  private async _executeFlowNode(flowNode: Model.Base.FlowNode,
                                 processToken: Runtime.Types.ProcessToken,
                                 processTokenFacade: IProcessTokenFacade,
                                 processModelFacade: IProcessModelFacade,
                                 identity: IIdentity,
                                 processStateInfo: IProcessStateInfo): Promise<void> {

    const flowNodeHandler: IFlowNodeHandler<Model.Base.FlowNode> = await this.flowNodeHandlerFactory.create(flowNode, processModelFacade);

    const nextFlowNodeInfo: NextFlowNodeInfo =
      await flowNodeHandler.execute(flowNode, processToken, processTokenFacade, processModelFacade, identity);

    const nextFlowNodeInfoHasFlowNode: boolean = nextFlowNodeInfo.flowNode !== undefined;

    const processWasTerminated: boolean = processStateInfo.processTerminatedMessage !== undefined;

    if (processWasTerminated) {
      const flowNodeInstanceId: string = flowNodeHandler.getInstanceId();
      await this.flowNodeInstanceService.persistOnTerminate(flowNode.id, flowNodeInstanceId, processToken);
    } else if (nextFlowNodeInfoHasFlowNode) {
      await this._executeFlowNode(nextFlowNodeInfo.flowNode,
                                  nextFlowNodeInfo.token,
                                  nextFlowNodeInfo.processTokenFacade,
                                  processModelFacade,
                                  identity,
                                  processStateInfo);
    }
  }

  private async _getFinalResult(processTokenFacade: IProcessTokenFacade): Promise<IProcessTokenResult> {

    const allResults: Array<IProcessTokenResult> = await processTokenFacade.getAllResults();

    return allResults.pop();
  }

}
