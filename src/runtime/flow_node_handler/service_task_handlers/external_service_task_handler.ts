import {Logger} from 'loggerhythm';

import {InternalServerError} from '@essential-projects/errors_ts';
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

import {FlowNodeHandlerInterruptible} from '../index';

export class ExternalServiceTaskHandler extends FlowNodeHandlerInterruptible<Model.Activities.ServiceTask> {

  private _externalTaskRepository: IExternalTaskRepository;

  private externalTaskSubscription: Subscription;

  constructor(
    eventAggregator: IEventAggregator,
    externalTaskRepository: IExternalTaskRepository,
    flowNodeHandlerFactory: IFlowNodeHandlerFactory,
    flowNodePersistenceFacade: IFlowNodePersistenceFacade,
    serviceTaskModel: Model.Activities.ServiceTask,
  ) {
    super(eventAggregator, flowNodeHandlerFactory, flowNodePersistenceFacade, serviceTaskModel);

    this._externalTaskRepository = externalTaskRepository;
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

    return this._executeHandler(token, processTokenFacade, processModelFacade, identity);
  }

  protected async _continueAfterSuspend(
    flowNodeInstance: FlowNodeInstance,
    onSuspendToken: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    const resumerPromise: Promise<Array<Model.Base.FlowNode>> =
      new Promise<Array<Model.Base.FlowNode>>(async(resolve: Function, reject: Function): Promise<void> => {

      // Callback for processing an ExternalTask result.
      let processExternalTaskResult: Function = async(error: Error, result: any): Promise<void> => {

        if (error) {
          this.logger.error(`External processing of ServiceTask failed!`, error);
          await this.persistOnError(onSuspendToken, error);

          return reject(error);
        }

        this.logger.verbose('External processing of the ServiceTask finished successfully.');
        onSuspendToken.payload = result;

        await this.persistOnResume(onSuspendToken);
        processTokenFacade.addResultForFlowNode(this.serviceTask.id, this.flowNodeInstanceId, onSuspendToken.payload);
        await this.persistOnExit(onSuspendToken);

        const nextFlowNode: Array<Model.Base.FlowNode> = processModelFacade.getNextFlowNodesFor(this.serviceTask);
        resolve(nextFlowNode);
      };

      this.onInterruptedCallback = async(): Promise<void> => {

        await this._abortExternalTask(onSuspendToken);

        if (this.externalTaskSubscription) {
          this.eventAggregator.unsubscribe(this.externalTaskSubscription);
        }
        resumerPromise.cancel();

        processExternalTaskResult = (): void => { return; };

        return;
      };

      const externalTask: ExternalTask<any> = await this._getExternalTaskForFlowNodeInstance(flowNodeInstance);

      const noMatchingExteralTaskExists: boolean = !externalTask;
      if (noMatchingExteralTaskExists) {
        // No ExternalTask has been created yet. We can just execute the normal handler.
        const result: any = await this._executeExternalServiceTask(onSuspendToken, processTokenFacade, identity);

        processTokenFacade.addResultForFlowNode(this.serviceTask.id, this.flowNodeInstanceId, result);
        onSuspendToken.payload = result;
        await this.persistOnExit(onSuspendToken);

        const nextFlowNode: Array<Model.Base.FlowNode> = processModelFacade.getNextFlowNodesFor(this.serviceTask);

        return resolve(nextFlowNode);
      }

      const externalTaskIsAlreadyFinished: boolean = externalTask.state === ExternalTaskState.finished;
      if (externalTaskIsAlreadyFinished) {
        // The external worker has already finished processing the ExternalTask
        // and we only missed the notification.
        // We can continue with the ExternalTask we retrieved from the database.
        processExternalTaskResult(externalTask.error, externalTask.result);
      } else {
        // The external worker has not yet finished processing the ExternalTask.
        // We must wait for the notification and pass the result to our customized callback.
        this._waitForExternalTaskResult(processExternalTaskResult);
      }
    });

    return resumerPromise;
  }

  protected async _executeHandler(
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    const handlerPromise: Promise<Array<Model.Base.FlowNode>> =
      new Promise<Array<Model.Base.FlowNode>>(async(resolve: Function, reject: Function): Promise<void> => {

      try {
        this.logger.verbose('Executing external ServiceTask');
        await this.persistOnSuspend(token);

        this.onInterruptedCallback = async(): Promise<void> => {

          await this._abortExternalTask(token);

          handlerPromise.cancel();

          return;
        };
        const result: any = await this._executeExternalServiceTask(token, processTokenFacade, identity);

        processTokenFacade.addResultForFlowNode(this.serviceTask.id, this.flowNodeInstanceId, result);
        token.payload = result;

        await this.persistOnExit(token);

        const nextFlowNodeInfo: Array<Model.Base.FlowNode> = processModelFacade.getNextFlowNodesFor(this.serviceTask);

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
  private async _executeExternalServiceTask(
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    identity: IIdentity,
  ): Promise<any> {

    return new Promise<any>(async(resolve: Function, reject: Function): Promise<any> => {

      try {
        const externalTaskFinishedCallback: Function = async(error: Error, result: any): Promise<void> => {

          if (error) {
            this.logger.error(`The external worker failed to process the ExternalTask!`, error);
            await this.persistOnError(token, error);

            return reject(error);
          }

          this.logger.verbose('The external worker successfully finished processing the ExternalTask.');
          token.payload = result;

          await this.persistOnResume(token);

          return resolve(result);
        };

        this._waitForExternalTaskResult(externalTaskFinishedCallback);

        const tokenHistory: any = processTokenFacade.getOldTokenFormat();
        const payload: any = this._getServiceTaskPayload(token, tokenHistory, identity);

        await this._createExternalTask(token, payload);
        this._publishExternalTaskCreatedNotification();

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
  private _waitForExternalTaskResult(resolveFunc: Function): void {

    const externalTaskFinishedEventName: string = `/externaltask/flownodeinstance/${this.flowNodeInstanceId}/finished`;

    this.externalTaskSubscription =
      this.eventAggregator.subscribeOnce(externalTaskFinishedEventName, async(message: any): Promise<void> => {
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
  private async _getExternalTaskForFlowNodeInstance(flowNodeInstance: FlowNodeInstance): Promise<ExternalTask<any>> {

    try {
      const matchingExternalTask: ExternalTask<any> =
        await this._externalTaskRepository.getByInstanceIds(flowNodeInstance.correlationId, flowNodeInstance.processInstanceId, flowNodeInstance.id);

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
  private _getServiceTaskPayload(token: ProcessToken, tokenHistory: any, identity: IIdentity): any {

    try {
      const serviceTaskHasAttachedPayload: boolean = this.serviceTask.payload !== undefined;

      if (serviceTaskHasAttachedPayload) {
        const evaluatePayloadFunction: Function = new Function('token', 'identity', `return ${this.serviceTask.payload}`);

        return evaluatePayloadFunction.call(tokenHistory, tokenHistory, identity);
      } else {
        return token.payload;
      }
    } catch (error) {
      const errorMessage: string = `ExternalTask payload configuration '${this.serviceTask.payload}' is invalid!`;
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
  private async _createExternalTask(token: ProcessToken, exernalTaskPayload: any): Promise<void> {

    this.logger.verbose('Persist ServiceTask as ExternalTask.');
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
    this.eventAggregator.publish(externalTaskCreatedEventName);
  }

  private async _abortExternalTask(token: ProcessToken): Promise<void> {

    const matchingExternalTask: ExternalTask<any> =
      await this._externalTaskRepository.getByInstanceIds(token.correlationId, token.processInstanceId, this.flowNodeInstanceId);

    const taskIsAlreadyFinished: boolean = matchingExternalTask.state === ExternalTaskState.finished;
    if (taskIsAlreadyFinished) {
      return;
    }

    const abortError: Error = new InternalServerError('The ExternalTask was aborted, because the corresponding ProcessInstance was interrupted!');

    await this._externalTaskRepository.finishWithError(matchingExternalTask.id, abortError);
  }
}
