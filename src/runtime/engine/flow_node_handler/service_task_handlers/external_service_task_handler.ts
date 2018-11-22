import {Logger} from 'loggerhythm';

import {IEventAggregator, ISubscription} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';

import {ExternalTask, IExternalTaskRepository} from '@process-engine/external_task_api_contracts';
import {ILoggingApi} from '@process-engine/logging_api_contracts';
import {IMetricsApi} from '@process-engine/metrics_api_contracts';
import {
  IFlowNodeInstanceService,
  IProcessModelFacade,
  IProcessTokenFacade,
  Model,
  NextFlowNodeInfo,
  Runtime,
} from '@process-engine/process_engine_contracts';

import {FlowNodeHandler} from '../index';

const logger: Logger = Logger.createLogger('processengine:runtime:external_service_task');

export class ExternalServiceTaskHandler extends FlowNodeHandler<Model.Activities.ServiceTask> {

  private _eventAggregator: IEventAggregator;
  private _externalTaskRepository: IExternalTaskRepository;

  constructor(eventAggregator: IEventAggregator,
              externalTaskRepository: IExternalTaskRepository,
              flowNodeInstanceService: IFlowNodeInstanceService,
              loggingApiService: ILoggingApi,
              metricsService: IMetricsApi,
              serviceTaskModel: Model.Activities.ServiceTask) {

    super(flowNodeInstanceService, loggingApiService, metricsService, serviceTaskModel);

    this._eventAggregator = eventAggregator;
    this._externalTaskRepository = externalTaskRepository;
  }

  private get serviceTask(): Model.Activities.ServiceTask {
    return super.flowNode;
  }

  protected async executeInternally(token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    identity: IIdentity,
                                   ): Promise<NextFlowNodeInfo> {

    await this.persistOnEnter(token);

    logger.verbose('Executing external ServiceTask');
    await this.persistOnSuspend(token);
    const result: any = await this._executeExternalServiceTask(token, processTokenFacade, identity);

    processTokenFacade.addResultForFlowNode(this.serviceTask.id, result);
    token.payload = result;

    await this.persistOnExit(token);

    return this.getNextFlowNodeInfo(token, processTokenFacade, processModelFacade);
  }

  /**
   * Creates a new ExternalTask and delegates its execution to an
   * external Service.
   * The handler will be suspended, until the ExternalTask has finished.
   *
   * @async
   * @param   token              The current ProcessToken.
   * @param   processTokenFacade The Facade for accessing all ProcessTokens of the
   *                             currently running ProcessInstance.
   * @param   identity           The identity that started the ProcessInstance.
   * @returns                    The ServiceTask's result.
   */
  private async _executeExternalServiceTask(token: Runtime.Types.ProcessToken,
                                            processTokenFacade: IProcessTokenFacade,
                                            identity: IIdentity,
                                           ): Promise<any> {

    return new Promise(async(resolve: Function, reject: Function): Promise<any> => {

      const externalTaskFinishedCallback: Function = async(error: Error, result: any): Promise<void> => {

        if (error) {
          logger.error(`External processing of ServiceTask failed!`, error);
          await this.persistOnError(token, error);

          throw error;
        }

        logger.verbose('External processing of the ServiceTask finished successfully.');
        token.payload = result;

        await this.persistOnResume(token);

        resolve(result);
      };

      this._waitForExternalTaskResult(externalTaskFinishedCallback);

      const tokenHistory: any = await processTokenFacade.getOldTokenFormat();
      const payload: any = this._getServiceTaskPayload(token, tokenHistory, identity);

      await this._createExternalTask(token, payload);
      this._publishExternalTaskCreatedNotification();

      logger.verbose('Waiting for ServiceTask to be finished by an external worker.');
    });
  }

  /**
   * Waits for a message from the EventAggregator about the ExternalTask being finished.
   *
   * @param resolveFunc The function to call after the message was received.
   */
  private _waitForExternalTaskResult(resolveFunc: Function): void {

    const externalTaskFinishedEventName: string = `/externaltask/flownodeinstance/${this.flowNodeInstanceId}/finished`;

    const messageReceivedCallback: Function = async(message: any): Promise<void> => {

      if (subscription) {
        subscription.dispose();
      }

      resolveFunc(message.error, message.result);
    };

    const subscription: ISubscription = this._eventAggregator.subscribeOnce(externalTaskFinishedEventName, messageReceivedCallback);
  }

  /**
   * Retrives the payload to use with the ExternalTask.
   *
   * This will either be the "payload" property of the FlowNode, if it exists,
   * or the current token.
   *
   * @param   token        The current ProcessToken.
   * @param   tokenHistory The full token history.
   * @param   identity     The requesting users identity.
   * @returns              The retrieved payload for the ExternalTask.
   */
  private _getServiceTaskPayload(token: Runtime.Types.ProcessToken, tokenHistory: any, identity: IIdentity): any {

    const serviceTaskHasAttachedPayload: boolean = this.serviceTask.payload !== undefined;

    if (serviceTaskHasAttachedPayload) {
      const evaluatePayloadFunction: Function = new Function('token', 'identity', `return ${this.serviceTask.payload}`);

      return evaluatePayloadFunction.call(tokenHistory, identity, tokenHistory);
    } else {
      return token.payload;
    }
  }

  /**
   * Creates a new ExternalTask in the database that an external worker can
   * retrieve and process.
   *
   * @async
   * @param token              The current ProcessToken.
   * @param exernalTaskPayload The ExternalTask's payload.
   */
  private async _createExternalTask(token: Runtime.Types.ProcessToken, exernalTaskPayload: any): Promise<void> {

    logger.verbose('Persist ServiceTask as ExternalTask.');
    await this._externalTaskRepository.create(this.serviceTask.topic,
                                              token.correlationId,
                                              token.processModelId,
                                              token.processInstanceId,
                                              this.flowNodeInstanceId,
                                              token.identity,
                                              exernalTaskPayload);
  }

  /**
   * Sends a notification about a newly created ExternalTask.
   * This is part of the Long-polling feature of the ExternalTaskAPI.
   */
  private _publishExternalTaskCreatedNotification(): void {
    const externalTaskCreatedEventName: string = `/externaltask/topic/${this.serviceTask.topic}/created`;
    this._eventAggregator.publish(externalTaskCreatedEventName);
  }
}
