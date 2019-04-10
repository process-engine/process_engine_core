import {Logger} from 'loggerhythm';

import {InternalServerError} from '@essential-projects/errors_ts';
import {IEventAggregator, Subscription} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';

import {FlowNodeInstance, ProcessToken} from '@process-engine/flow_node_instance.contracts';
import {
  eventAggregatorSettings,
  FinishUserTaskMessage,
  IFlowNodeHandlerFactory,
  IFlowNodePersistenceFacade,
  IProcessModelFacade,
  IProcessTokenFacade,
  UserTaskFinishedMessage,
  UserTaskReachedMessage,
} from '@process-engine/process_engine_contracts';
import {Model} from '@process-engine/process_model.contracts';

import {ActivityHandler} from './activity_handler';

export class UserTaskHandler extends ActivityHandler<Model.Activities.UserTask> {

  private userTaskSubscription: Subscription;

  constructor(
    eventAggregator: IEventAggregator,
    flowNodeHandlerFactory: IFlowNodeHandlerFactory,
    flowNodePersistenceFacade: IFlowNodePersistenceFacade,
    userTaskModel: Model.Activities.UserTask,
   ) {
    super(eventAggregator, flowNodeHandlerFactory, flowNodePersistenceFacade, userTaskModel);
    this.logger = new Logger(`processengine:user_task_handler:${userTaskModel.id}`);
  }

  private get userTask(): Model.Activities.UserTask {
    return super.flowNode;
  }

  protected async executeInternally(
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    this.logger.verbose(`Executing UserTask instance ${this.flowNodeInstanceId}`);
    await this.persistOnEnter(token);

    return this._executeHandler(token, processTokenFacade, processModelFacade, identity);
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
          this._validateUserTaskFormFieldConfigurations(token, processTokenFacade);

          this.onInterruptedCallback = (): void => {
            const subscriptionIsActive: boolean = this.userTaskSubscription !== undefined;
            if (subscriptionIsActive) {
              this.eventAggregator.unsubscribe(this.userTaskSubscription);
            }
            handlerPromise.cancel();

            return;
          };

          const userTaskResult: any = await this._suspendAndWaitForUserTaskResult(identity, token);
          token.payload = userTaskResult;

          await this.persistOnResume(token);

          processTokenFacade.addResultForFlowNode(this.userTask.id, this.flowNodeInstanceId, userTaskResult);
          await this.persistOnExit(token);

          this._sendUserTaskFinishedNotification(identity, token);

          const nextFlowNodeInfo: Array<Model.Base.FlowNode> = processModelFacade.getNextFlowNodesFor(this.userTask);

          return resolve(nextFlowNodeInfo);
        } catch (error) {
          this.logger.error('Failed to execute UserTask!', error);

          return reject(error);
        }
    });

    return handlerPromise;
  }

  protected async _continueAfterSuspend(
    flowNodeInstance: FlowNodeInstance,
    onSuspendToken: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    const handlerPromise: Promise<Array<Model.Base.FlowNode>> =
      new Promise<Array<Model.Base.FlowNode>>(async(resolve: Function, reject: Function): Promise<void> => {

        this.onInterruptedCallback = (): void => {
          const subscriptionIsActive: boolean = this.userTaskSubscription !== undefined;
          if (subscriptionIsActive) {
            this.eventAggregator.unsubscribe(this.userTaskSubscription);
          }
          handlerPromise.cancel();

          return;
        };

        const waitForMessagePromise: Promise<any> = this._waitForUserTaskResult(identity, onSuspendToken);

        this._sendUserTaskReachedNotification(identity, onSuspendToken);

        const userTaskResult: any = await waitForMessagePromise;

        onSuspendToken.payload = userTaskResult;

        await this.persistOnResume(onSuspendToken);

        processTokenFacade.addResultForFlowNode(this.userTask.id, this.flowNodeInstanceId, userTaskResult);
        await this.persistOnExit(onSuspendToken);

        this._sendUserTaskFinishedNotification(identity, onSuspendToken);

        const nextFlowNodeInfo: Array<Model.Base.FlowNode> = processModelFacade.getNextFlowNodesFor(this.userTask);

        return resolve(nextFlowNodeInfo);
      });

    return handlerPromise;
  }

  private _validateUserTaskFormFieldConfigurations(token: ProcessToken, processTokenFacade: IProcessTokenFacade): void {

    const oldTokenFormat: any = processTokenFacade.getOldTokenFormat();

    for (const formField of this.userTask.formFields) {
      try {
        this._validateExpression(formField.label, oldTokenFormat);
        this._validateExpression(formField.defaultValue, oldTokenFormat);
        this._validateExpression(formField.preferredControl, oldTokenFormat);
      } catch (error) {
        const errorMessage: string = `The configuration for FormField ${formField.id} is invalid!`;

        const invalidFormFieldError: InternalServerError = new InternalServerError(errorMessage);

        const errorDetails: any = {
          processModelId: token.processModelId,
          processInstanceId: token.processInstanceId,
          correlationId: token.correlationId,
          userTaskId: this.userTask.id,
          userTaskInstanceId: this.flowNodeInstanceId,
          invalidFormFieldId: formField.id,
          currentToken: oldTokenFormat,
          validationError: error.message,
        };

        invalidFormFieldError.additionalInformation = errorDetails;

        this.logger.error(errorMessage);

        this.persistOnError(token, invalidFormFieldError);
        throw invalidFormFieldError;
      }
    }
  }

  private _validateExpression(expression: string, token: any): void {

    try {
      if (!expression) {
        return;
      }

      const expressionStartsOn: string = '${';
      const expressionEndsOn: string = '}';

      const isExpression: boolean = expression.charAt(0) === '$';
      if (isExpression === false) {
        return;
      }

      const finalExpressionLength: number = expression.length - expressionStartsOn.length - expressionEndsOn.length;
      const expressionBody: string = expression.substr(expressionStartsOn.length, finalExpressionLength);

      const functionString: string = `return ${expressionBody}`;
      const scriptFunction: Function = new Function('token', functionString);

      scriptFunction.call(token, token);
    } catch (error) {
      const errorMsg: string = `Cannot evaluate expression ${expression}! The ProcessToken is missing some required properties!`;
      this.logger.error(errorMsg);

      throw new InternalServerError(errorMsg);
    }
  }

  /**
   * Suspends the handler and waits for a FinishUserTaskMessage.
   * Upon receiving the messsage, the handler will be resumed with the received
   * result set.
   *
   * @async
   * @param identity The identity that owns the UserTask instance.
   * @param token    Contains all relevant info the EventAggregator will need for
   *                 creating the EventSubscription.
   * @returns        The recevied UserTask result.
   */
  private async _suspendAndWaitForUserTaskResult(identity: IIdentity, token: ProcessToken): Promise<any> {
    const waitForUserTaskResultPromise: Promise<any> = this._waitForUserTaskResult(identity, token);
    await this.persistOnSuspend(token);

    this._sendUserTaskReachedNotification(identity, token);

    return await waitForUserTaskResultPromise;
  }

  /**
   * Waits for a FinishUserTaskMessage.
   * Upon receiving the messsage, the handler will be resumed with the received
   * result set.
   *
   * @async
   * @param identity The identity that owns the UserTask instance.
   * @param token    Contains all relevant info the EventAggregator will need for
   *                 creating the EventSubscription.
   * @returns        The recevied UserTask result.
   */
  private _waitForUserTaskResult(identity: IIdentity, token: ProcessToken): Promise<any> {

    return new Promise<any>(async(resolve: Function): Promise<void> => {

      const finishUserTaskEvent: string = this._getFinishUserTaskEventName(token.correlationId, token.processInstanceId);

      this.userTaskSubscription =
        this.eventAggregator.subscribeOnce(finishUserTaskEvent, async(message: FinishUserTaskMessage): Promise<void> => {
          const userTaskResult: any = {
            form_fields: message.result || null,
          };

          resolve(userTaskResult);
        });
    });
  }

  /**
   * Publishes a notification on the EventAggregator, informing about a new
   * suspended UserTask.
   *
   * @param identity The identity that owns the UserTask instance.
   * @param token    Contains all infos required for the Notification message.
   */
  private _sendUserTaskReachedNotification(identity: IIdentity, token: ProcessToken): void {

    const message: UserTaskReachedMessage = new UserTaskReachedMessage(token.correlationId,
                                                                       token.processModelId,
                                                                       token.processInstanceId,
                                                                       this.userTask.id,
                                                                       this.flowNodeInstanceId,
                                                                       identity,
                                                                       token.payload);

    this.eventAggregator.publish(eventAggregatorSettings.messagePaths.userTaskReached, message);
  }

  /**
   * Publishes notifications on the EventAggregator, informing that a UserTask
   * has received a result and finished execution.
   *
   * Two notifications will be send:
   * - A global notification that everybody can receive
   * - A notification specifically for this UserTask.
   *
   * @param identity The identity that owns the UserTask instance.
   * @param token    Contains all infos required for the Notification message.
   */
  private _sendUserTaskFinishedNotification(identity: IIdentity, token: ProcessToken): void {

    const message: UserTaskFinishedMessage = new UserTaskFinishedMessage(token.payload,
                                                                         token.correlationId,
                                                                         token.processModelId,
                                                                         token.processInstanceId,
                                                                         this.userTask.id,
                                                                         this.flowNodeInstanceId,
                                                                         identity,
                                                                         token.payload);

    // FlowNode-specific notification
    const userTaskFinishedEvent: string = this._getUserTaskFinishedEventName(token.correlationId, token.processInstanceId);
    this.eventAggregator.publish(userTaskFinishedEvent, message);

    // Global notification
    this.eventAggregator.publish(eventAggregatorSettings.messagePaths.userTaskFinished, message);
  }

  private _getFinishUserTaskEventName(correlationId: string, processInstanceId: string): string {

    const finishUserTaskEvent: string = eventAggregatorSettings.messagePaths.finishUserTask
      .replace(eventAggregatorSettings.messageParams.correlationId, correlationId)
      .replace(eventAggregatorSettings.messageParams.processInstanceId, processInstanceId)
      .replace(eventAggregatorSettings.messageParams.flowNodeInstanceId, this.flowNodeInstanceId);

    return finishUserTaskEvent;
  }

  private _getUserTaskFinishedEventName(correlationId: string, processInstanceId: string): string {

    // FlowNode-specific notification
    const userTaskFinishedEvent: string = eventAggregatorSettings.messagePaths.userTaskWithInstanceIdFinished
      .replace(eventAggregatorSettings.messageParams.correlationId, correlationId)
      .replace(eventAggregatorSettings.messageParams.processInstanceId, processInstanceId)
      .replace(eventAggregatorSettings.messageParams.flowNodeInstanceId, this.flowNodeInstanceId);

    return userTaskFinishedEvent;
  }
}
