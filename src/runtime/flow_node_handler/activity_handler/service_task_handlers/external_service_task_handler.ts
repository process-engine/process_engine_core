/* eslint-disable consistent-return */
import {Logger} from 'loggerhythm';

import {BaseError, InternalServerError} from '@essential-projects/errors_ts';
import {IEventAggregator, Subscription} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';

import {ExternalTask, ExternalTaskState, IExternalTaskRepository} from '@process-engine/external_task_api_contracts';
import {FlowNodeInstance, ProcessToken} from '@process-engine/flow_node_instance.contracts';
import {
  IFlowNodeHandlerFactory,
  IFlowNodePersistenceFacade,
  IProcessModelFacade,
  IProcessTokenFacade,
} from '@process-engine/process_engine_contracts';
import {Model} from '@process-engine/process_model.contracts';

import {ActivityHandler} from '../activity_handler';

export class ExternalServiceTaskHandler extends ActivityHandler<Model.Activities.ServiceTask> {

  private externalTaskRepository: IExternalTaskRepository;

  private externalTaskSubscription: Subscription;

  constructor(
    eventAggregator: IEventAggregator,
    externalTaskRepository: IExternalTaskRepository,
    flowNodeHandlerFactory: IFlowNodeHandlerFactory,
    flowNodePersistenceFacade: IFlowNodePersistenceFacade,
    serviceTaskModel: Model.Activities.ServiceTask,
  ) {
    super(eventAggregator, flowNodeHandlerFactory, flowNodePersistenceFacade, serviceTaskModel);

    this.externalTaskRepository = externalTaskRepository;
    this.logger = Logger.createLogger(`processengine:external_service_task:${serviceTaskModel.id}`);
  }

  private get serviceTask(): Model.Activities.ServiceTask {
    return super.flowNode;
  }

  protected async executeInternally(
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    this.logger.verbose(`Executing external ServiceTask instance ${this.flowNodeInstanceId}`);
    await this.persistOnEnter(token);

    return this.executeHandler(token, processTokenFacade, processModelFacade, identity);
  }

  protected async continueAfterSuspend(
    flowNodeInstance: FlowNodeInstance,
    onSuspendToken: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    const resumerPromise = new Promise<Array<Model.Base.FlowNode>>(async (resolve: Function, reject: Function): Promise<void> => {

      // Callback for processing an ExternalTask result.
      let processExternalTaskResult = async (error: Error, result: any): Promise<void> => {

        if (error) {
          this.logger.error('External processing of ServiceTask failed!', error);
          onSuspendToken.payload = {
            errorMessage: error.message,
            errorCode: (error as BaseError).code,
          };
          await this.persistOnError(onSuspendToken, error);

          return reject(error);
        }

        this.logger.verbose('External processing of the ServiceTask finished successfully.');
        onSuspendToken.payload = result;

        await this.persistOnResume(onSuspendToken);
        processTokenFacade.addResultForFlowNode(this.serviceTask.id, this.flowNodeInstanceId, onSuspendToken.payload);
        await this.persistOnExit(onSuspendToken);

        const nextFlowNode = processModelFacade.getNextFlowNodesFor(this.serviceTask);
        return resolve(nextFlowNode);
      };

      this.onInterruptedCallback = async (): Promise<void> => {

        await this.abortExternalTask(onSuspendToken);

        if (this.externalTaskSubscription) {
          this.eventAggregator.unsubscribe(this.externalTaskSubscription);
        }
        resumerPromise.cancel();

        processExternalTaskResult = async (error: Error, result: any): Promise<void> => { };

        return undefined;
      };

      const externalTask: ExternalTask<any> = await this.getExternalTaskForFlowNodeInstance(flowNodeInstance);

      const noMatchingExteralTaskExists = !externalTask;
      if (noMatchingExteralTaskExists) {
        // No ExternalTask has been created yet. We can just execute the normal handler.
        const result = await this.executeExternalServiceTask(onSuspendToken, processTokenFacade, identity);

        processTokenFacade.addResultForFlowNode(this.serviceTask.id, this.flowNodeInstanceId, result);
        onSuspendToken.payload = result;
        await this.persistOnExit(onSuspendToken);

        const nextFlowNode = processModelFacade.getNextFlowNodesFor(this.serviceTask);

        return resolve(nextFlowNode);
      }

      const externalTaskIsAlreadyFinished = externalTask.state === ExternalTaskState.finished;
      if (externalTaskIsAlreadyFinished) {
        // The external worker has already finished processing the ExternalTask
        // and we only missed the notification.
        // We can continue with the ExternalTask we retrieved from the database.
        processExternalTaskResult(externalTask.error, externalTask.result);
      } else {
        // The external worker has not yet finished processing the ExternalTask.
        // We must wait for the notification and pass the result to our customized callback.
        this.waitForExternalTaskResult(processExternalTaskResult);
      }
    });

    return resumerPromise;
  }

  protected async executeHandler(
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    const handlerPromise = new Promise<Array<Model.Base.FlowNode>>(async (resolve: Function, reject: Function): Promise<void> => {

      try {
        this.logger.verbose('Executing external ServiceTask');
        await this.persistOnSuspend(token);

        this.onInterruptedCallback = async (): Promise<void> => {

          await this.abortExternalTask(token);

          handlerPromise.cancel();

          return undefined;
        };
        const result = await this.executeExternalServiceTask(token, processTokenFacade, identity);

        processTokenFacade.addResultForFlowNode(this.serviceTask.id, this.flowNodeInstanceId, result);
        token.payload = result;

        await this.persistOnExit(token);

        const nextFlowNodeInfo = processModelFacade.getNextFlowNodesFor(this.serviceTask);

        return resolve(nextFlowNodeInfo);
      } catch (error) {
        return reject(error);
      }
    });

    return handlerPromise;
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
  private async executeExternalServiceTask(
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    identity: IIdentity,
  ): Promise<any> {

    return new Promise<any>(async (resolve: Function, reject: Function): Promise<any> => {

      try {
        const externalTaskFinishedCallback: Function = async (error: Error, result: any): Promise<void> => {

          if (error) {
            this.logger.error('The external worker failed to process the ExternalTask!', error);
            token.payload = {
              errorMessage: error.message,
              errorCode: (error as BaseError).code,
            };
            await this.persistOnError(token, error);

            return reject(error);
          }

          this.logger.verbose('The external worker successfully finished processing the ExternalTask.');
          token.payload = result;

          await this.persistOnResume(token);

          return resolve(result);
        };

        this.waitForExternalTaskResult(externalTaskFinishedCallback);

        const tokenHistory = processTokenFacade.getOldTokenFormat();
        const payload = this.getServiceTaskPayload(token, tokenHistory, identity);

        await this.createExternalTask(token, payload);
        this.publishExternalTaskCreatedNotification();

        this.logger.verbose('Waiting for external ServiceTask to be finished by an external worker.');
      } catch (error) {
        this.logger.error('Failed to execute external ServiceTask!');
        this.logger.error(error);
        await this.persistOnError(token, error);

        return reject(error);
      }
    });
  }

  /**
   * Waits for a message from the EventAggregator about the ExternalTask being finished.
   *
   * @param resolveFunc The function to call after the message was received.
   */
  private waitForExternalTaskResult(resolveFunc: Function): void {

    const externalTaskFinishedEventName = `/externaltask/flownodeinstance/${this.flowNodeInstanceId}/finished`;

    this.externalTaskSubscription =
      this.eventAggregator.subscribeOnce(externalTaskFinishedEventName, async (message: any): Promise<void> => {
        resolveFunc(message.error, message.result);
      });
  }

  /**
   * Looks for an existing ExternalTask for the given FlowNodeInstance.
   *
   * @async
   * @param   flowNodeInstance The FlowNodeInstance for which to get an
   *                           ExternalTask.
   * @returns                  The retrieved ExternalTask, or undefined, if no
   *                           such ExternalTask exists.
   */
  private async getExternalTaskForFlowNodeInstance(flowNodeInstance: FlowNodeInstance): Promise<ExternalTask<any>> {

    try {
      const matchingExternalTask = await this
        .externalTaskRepository
        .getByInstanceIds(flowNodeInstance.correlationId, flowNodeInstance.processInstanceId, flowNodeInstance.id);

      return matchingExternalTask;
    } catch (error) {
      this.logger.info('No external task has been stored for this FlowNodeInstance.');

      return undefined;
    }
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
  private getServiceTaskPayload(token: ProcessToken, tokenHistory: any, identity: IIdentity): any {

    try {
      const serviceTaskHasAttachedPayload = this.serviceTask.payload !== undefined;

      if (serviceTaskHasAttachedPayload) {
        const evaluatePayloadFunction = new Function('token', 'identity', `return ${this.serviceTask.payload}`);

        return evaluatePayloadFunction.call(tokenHistory, tokenHistory, identity);
      }

      return token.payload;
    } catch (error) {
      const errorMessage = `ExternalTask payload configuration '${this.serviceTask.payload}' is invalid!`;
      this.logger.error(errorMessage);

      throw new InternalServerError(errorMessage);
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
  private async createExternalTask(token: ProcessToken, exernalTaskPayload: any): Promise<void> {

    this.logger.verbose('Persist ServiceTask as ExternalTask.');
    await this.externalTaskRepository.create(
      this.serviceTask.topic,
      token.correlationId,
      token.processModelId,
      token.processInstanceId,
      this.flowNodeInstanceId,
      token.identity,
      exernalTaskPayload,
    );
  }

  /**
   * Sends a notification about a newly created ExternalTask.
   * This is part of the Long-polling feature of the ExternalTaskAPI.
   */
  private publishExternalTaskCreatedNotification(): void {
    const externalTaskCreatedEventName = `/externaltask/topic/${this.serviceTask.topic}/created`;
    this.eventAggregator.publish(externalTaskCreatedEventName);
  }

  private async abortExternalTask(token: ProcessToken): Promise<void> {

    const matchingExternalTask: ExternalTask<any> =
      await this.externalTaskRepository.getByInstanceIds(token.correlationId, token.processInstanceId, this.flowNodeInstanceId);

    const taskIsAlreadyFinished = matchingExternalTask.state === ExternalTaskState.finished;
    if (taskIsAlreadyFinished) {
      return;
    }

    const abortError = new InternalServerError('The ExternalTask was aborted, because the corresponding ProcessInstance was interrupted!');

    await this.externalTaskRepository.finishWithError(matchingExternalTask.id, abortError);
  }

}
