import {Logger} from 'loggerhythm';

import {IEventAggregator, Subscription} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';

import {
  eventAggregatorSettings,
  FinishUserTaskMessage,
  IFlowNodeHandlerFactory,
  IFlowNodePersistenceFacade,
  IProcessModelFacade,
  IProcessTokenFacade,
  Model,
  Runtime,
  UserTaskFinishedMessage,
  UserTaskReachedMessage,
} from '@process-engine/process_engine_contracts';

import {FlowNodeHandlerInterruptible} from './index';

export class UserTaskHandler extends FlowNodeHandlerInterruptible<Model.Activities.UserTask> {

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
    token: Runtime.Types.ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    this.logger.verbose(`Executing UserTask instance ${this.flowNodeInstanceId}`);
    await this.persistOnEnter(token);
    await this.persistOnSuspend(token);

    return this._executeHandler(token, processTokenFacade, processModelFacade, identity);
  }

  protected async _continueAfterEnter(
    onEnterToken: Runtime.Types.ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    await this.persistOnSuspend(onEnterToken);

    return this._executeHandler(onEnterToken, processTokenFacade, processModelFacade, identity);
  }

  protected async _continueAfterSuspend(
    flowNodeInstance: Runtime.Types.FlowNodeInstance,
    onSuspendToken: Runtime.Types.ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    return this._executeHandler(onSuspendToken, processTokenFacade, processModelFacade, identity);
  }

  protected async _executeHandler(
    token: Runtime.Types.ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    const handlerPromise: Promise<Array<Model.Base.FlowNode>> =
      new Promise<Array<Model.Base.FlowNode>>(async(resolve: Function, reject: Function): Promise<void> => {

      const executionPromise: Promise<any> = this._waitForUserTaskResult(identity, token);

      this.onInterruptedCallback = (): void => {
        if (this.userTaskSubscription) {
          this.eventAggregator.unsubscribe(this.userTaskSubscription);
        }
        executionPromise.cancel();
        handlerPromise.cancel();

        return;
      };

      const userTaskResult: any = await executionPromise;
      token.payload = userTaskResult;

      await this.persistOnResume(token);

      processTokenFacade.addResultForFlowNode(this.userTask.id, this.flowNodeInstanceId, userTaskResult);
      await this.persistOnExit(token);

      this._sendUserTaskFinishedNotification(identity, token);

      const nextFlowNodeInfo: Array<Model.Base.FlowNode> = processModelFacade.getNextFlowNodesFor(this.userTask);

      return resolve(nextFlowNodeInfo);
    });

    return handlerPromise;
  }

  /**
   * Suspends the current handler and waits for a FinishUserTaskMessage.
   * Upon receiving the messsage, the handler will be resumed with the received
   * result set.
   *
   * @async
   * @param identity The identity that owns the UserTask instance.
   * @param token    Contains all relevant info the EventAggregator will need for
   *                 creating the EventSubscription.
   * @returns        The recevied UserTask result.
   */
  private _waitForUserTaskResult(identity: IIdentity, token: Runtime.Types.ProcessToken): Promise<any> {

    return new Promise<any>(async(resolve: Function): Promise<void> => {

      const finishUserTaskEvent: string = this._getFinishUserTaskEventName(token.correlationId, token.processInstanceId);

      this.userTaskSubscription =
        this.eventAggregator.subscribeOnce(finishUserTaskEvent, async(message: FinishUserTaskMessage): Promise<void> => {
          const userTaskResult: any = {
            form_fields: message.result || null,
          };

          resolve(userTaskResult);
        });

      this._sendUserTaskReachedNotification(identity, token);
    });
  }

  /**
   * Publishes a notification on the EventAggregator, informing about a new
   * suspended UserTask.
   *
   * @param identity The identity that owns the UserTask instance.
   * @param token    Contains all infos required for the Notification message.
   */
  private _sendUserTaskReachedNotification(identity: IIdentity, token: Runtime.Types.ProcessToken): void {

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
  private _sendUserTaskFinishedNotification(identity: IIdentity, token: Runtime.Types.ProcessToken): void {

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
