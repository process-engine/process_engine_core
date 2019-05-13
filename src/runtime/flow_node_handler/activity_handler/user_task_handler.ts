import {Logger} from 'loggerhythm';

import {InternalServerError} from '@essential-projects/errors_ts';
import {IEventAggregator, Subscription} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';

import {FlowNodeInstance, ProcessToken} from '@process-engine/flow_node_instance.contracts';
import {
  FinishUserTaskMessage,
  IFlowNodeHandlerFactory,
  IFlowNodePersistenceFacade,
  IProcessModelFacade,
  IProcessTokenFacade,
  UserTaskFinishedMessage,
  UserTaskReachedMessage,
  eventAggregatorSettings,
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
    return this.flowNode;
  }

  protected async executeInternally(
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    this.logger.verbose(`Executing UserTask instance ${this.flowNodeInstanceId}`);
    await this.persistOnEnter(token);

    return this.executeHandler(token, processTokenFacade, processModelFacade, identity);
  }

  protected async executeHandler(
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    const handlerPromise = new Promise<Array<Model.Base.FlowNode>>(async (resolve: Function, reject: Function): Promise<void> => {

      try {
        this.validateUserTaskFormFieldConfigurations(token, processTokenFacade);

        this.onInterruptedCallback = (): void => {
          const subscriptionIsActive = this.userTaskSubscription !== undefined;
          if (subscriptionIsActive) {
            this.eventAggregator.unsubscribe(this.userTaskSubscription);
          }
          handlerPromise.cancel();

          return undefined;
        };

        const userTaskResult = await this.suspendAndWaitForUserTaskResult(identity, token);
        token.payload = userTaskResult;

        await this.persistOnResume(token);

        processTokenFacade.addResultForFlowNode(this.userTask.id, this.flowNodeInstanceId, userTaskResult);
        await this.persistOnExit(token);

        this.sendUserTaskFinishedNotification(identity, token);

        const nextFlowNodeInfo = processModelFacade.getNextFlowNodesFor(this.userTask);

        return resolve(nextFlowNodeInfo);
      } catch (error) {
        this.logger.error('Failed to execute UserTask!', error);

        return reject(error);
      }
    });

    return handlerPromise;
  }

  protected async continueAfterSuspend(
    flowNodeInstance: FlowNodeInstance,
    onSuspendToken: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    const handlerPromise = new Promise<Array<Model.Base.FlowNode>>(async (resolve: Function, reject: Function): Promise<void> => {

      this.onInterruptedCallback = (): void => {
        const subscriptionIsActive = this.userTaskSubscription !== undefined;
        if (subscriptionIsActive) {
          this.eventAggregator.unsubscribe(this.userTaskSubscription);
        }
        handlerPromise.cancel();

        return undefined;
      };

      const waitForMessagePromise = this.waitForUserTaskResult(identity, onSuspendToken);

      this.sendUserTaskReachedNotification(identity, onSuspendToken);

      const userTaskResult = await waitForMessagePromise;

      onSuspendToken.payload = userTaskResult;

      await this.persistOnResume(onSuspendToken);

      processTokenFacade.addResultForFlowNode(this.userTask.id, this.flowNodeInstanceId, userTaskResult);
      await this.persistOnExit(onSuspendToken);

      this.sendUserTaskFinishedNotification(identity, onSuspendToken);

      const nextFlowNodeInfo = processModelFacade.getNextFlowNodesFor(this.userTask);

      return resolve(nextFlowNodeInfo);
    });

    return handlerPromise;
  }

  private validateUserTaskFormFieldConfigurations(token: ProcessToken, processTokenFacade: IProcessTokenFacade): void {

    const oldTokenFormat = processTokenFacade.getOldTokenFormat();

    for (const formField of this.userTask.formFields) {
      try {
        this.validateExpression(formField.label, oldTokenFormat);
        this.validateExpression(formField.defaultValue, oldTokenFormat);
        this.validateExpression(formField.preferredControl, oldTokenFormat);
      } catch (error) {
        const errorMessage = `The configuration for FormField ${formField.id} is invalid!`;

        const invalidFormFieldError = new InternalServerError(errorMessage);

        const errorDetails = {
          processModelId: token.processModelId,
          processInstanceId: token.processInstanceId,
          correlationId: token.correlationId,
          userTaskId: this.userTask.id,
          userTaskInstanceId: this.flowNodeInstanceId,
          invalidFormFieldId: formField.id,
          currentToken: oldTokenFormat,
          validationError: error.message,
        };

        invalidFormFieldError.additionalInformation = errorDetails as any;

        this.logger.error(errorMessage);

        this.persistOnError(token, invalidFormFieldError);
        throw invalidFormFieldError;
      }
    }
  }

  private validateExpression(expression: string, token: any): void {

    try {
      if (!expression) {
        return;
      }

      const expressionStartsOn = '${';
      const expressionEndsOn = '}';

      const isExpression = expression.charAt(0) === '$';
      if (isExpression === false) {
        return;
      }

      const finalExpressionLength = expression.length - expressionStartsOn.length - expressionEndsOn.length;
      const expressionBody = expression.substr(expressionStartsOn.length, finalExpressionLength);

      const functionString = `return ${expressionBody}`;
      const scriptFunction = new Function('token', functionString);

      scriptFunction.call(token, token);
    } catch (error) {
      const errorMsg = `Cannot evaluate expression ${expression}! The ProcessToken is missing some required properties!`;
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
  private async suspendAndWaitForUserTaskResult(identity: IIdentity, token: ProcessToken): Promise<any> {
    const waitForUserTaskResultPromise = this.waitForUserTaskResult(identity, token);
    await this.persistOnSuspend(token);

    this.sendUserTaskReachedNotification(identity, token);

    return waitForUserTaskResultPromise;
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
  private waitForUserTaskResult(identity: IIdentity, token: ProcessToken): Promise<any> {

    return new Promise<any>(async (resolve: Function): Promise<void> => {

      const finishUserTaskEvent = this.getFinishUserTaskEventName(token.correlationId, token.processInstanceId);

      this.userTaskSubscription =
        this.eventAggregator.subscribeOnce(finishUserTaskEvent, async (message: FinishUserTaskMessage): Promise<void> => {
          const userTaskResult = {
            // TODO: We need to investigate how many components will break when we change this.
            // eslint-disable-next-line @typescript-eslint/camelcase
            form_fields: message.result || undefined,
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
  private sendUserTaskReachedNotification(identity: IIdentity, token: ProcessToken): void {

    const message = new UserTaskReachedMessage(
      token.correlationId,
      token.processModelId,
      token.processInstanceId,
      this.userTask.id,
      this.flowNodeInstanceId,
      identity,
      token.payload,
    );

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
  private sendUserTaskFinishedNotification(identity: IIdentity, token: ProcessToken): void {

    const message = new UserTaskFinishedMessage(
      token.payload,
      token.correlationId,
      token.processModelId,
      token.processInstanceId,
      this.userTask.id,
      this.flowNodeInstanceId,
      identity,
      token.payload,
    );

    // FlowNode-specific notification
    const userTaskFinishedEvent: string = this.getUserTaskFinishedEventName(token.correlationId, token.processInstanceId);
    this.eventAggregator.publish(userTaskFinishedEvent, message);

    // Global notification
    this.eventAggregator.publish(eventAggregatorSettings.messagePaths.userTaskFinished, message);
  }

  private getFinishUserTaskEventName(correlationId: string, processInstanceId: string): string {

    const finishUserTaskEvent: string = eventAggregatorSettings.messagePaths.finishUserTask
      .replace(eventAggregatorSettings.messageParams.correlationId, correlationId)
      .replace(eventAggregatorSettings.messageParams.processInstanceId, processInstanceId)
      .replace(eventAggregatorSettings.messageParams.flowNodeInstanceId, this.flowNodeInstanceId);

    return finishUserTaskEvent;
  }

  private getUserTaskFinishedEventName(correlationId: string, processInstanceId: string): string {

    // FlowNode-specific notification
    const userTaskFinishedEvent: string = eventAggregatorSettings.messagePaths.userTaskWithInstanceIdFinished
      .replace(eventAggregatorSettings.messageParams.correlationId, correlationId)
      .replace(eventAggregatorSettings.messageParams.processInstanceId, processInstanceId)
      .replace(eventAggregatorSettings.messageParams.flowNodeInstanceId, this.flowNodeInstanceId);

    return userTaskFinishedEvent;
  }

}
