import {InternalServerError} from '@essential-projects/errors_ts';
import {IEventAggregator, ISubscription} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';

import {ILoggingApi} from '@process-engine/logging_api_contracts';
import {IMetricsApi} from '@process-engine/metrics_api_contracts';
import {
  eventAggregatorSettings,
  FinishUserTaskMessage,
  IFlowNodeInstanceService,
  IProcessModelFacade,
  IProcessTokenFacade,
  Model,
  NextFlowNodeInfo,
  Runtime,
  UserTaskFinishedMessage,
  UserTaskReachedMessage,
} from '@process-engine/process_engine_contracts';

import {FlowNodeHandler} from './index';

export class UserTaskHandler extends FlowNodeHandler<Model.Activities.UserTask> {

  private _eventAggregator: IEventAggregator;

  constructor(eventAggregator: IEventAggregator,
              flowNodeInstanceService: IFlowNodeInstanceService,
              loggingApiService: ILoggingApi,
              metricsService: IMetricsApi,
              userTaskModel: Model.Activities.UserTask) {
    super(flowNodeInstanceService, loggingApiService, metricsService, userTaskModel);
    this._eventAggregator = eventAggregator;
  }

  private get userTask(): Model.Activities.UserTask {
    return super.flowNode;
  }

  protected async executeInternally(token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    identity: IIdentity): Promise<NextFlowNodeInfo> {

    await this.persistOnEnter(token);
    await this.persistOnSuspend(token);

    return this._executeHandler(token, processTokenFacade, processModelFacade);
  }

  protected async resumeInternally(flowNodeInstance: Runtime.Types.FlowNodeInstance,
                                   processTokenFacade: IProcessTokenFacade,
                                   processModelFacade: IProcessModelFacade,
                                   identity: IIdentity,
                                 ): Promise<NextFlowNodeInfo> {

    function getFlowNodeInstanceTokenByType(tokenType: Runtime.Types.ProcessTokenType): Runtime.Types.ProcessToken {
      return flowNodeInstance.tokens.find((token: Runtime.Types.ProcessToken): boolean => {
        return token.type === tokenType;
      });
    }

    switch (flowNodeInstance.state) {
      case Runtime.Types.FlowNodeInstanceState.suspended:
        const suspendToken: Runtime.Types.ProcessToken = getFlowNodeInstanceTokenByType(Runtime.Types.ProcessTokenType.onSuspend);

        return this._continueAfterSuspend(suspendToken, processTokenFacade, processModelFacade);
      case Runtime.Types.FlowNodeInstanceState.running:

        const resumeToken: Runtime.Types.ProcessToken = getFlowNodeInstanceTokenByType(Runtime.Types.ProcessTokenType.onResume);

        const userTaskResultNotYetAwaited: boolean = resumeToken === undefined;
        if (userTaskResultNotYetAwaited) {
          const onEnterToken: Runtime.Types.ProcessToken = getFlowNodeInstanceTokenByType(Runtime.Types.ProcessTokenType.onEnter);

          return this._continueAfterEnter(onEnterToken, processTokenFacade, processModelFacade);
        }

        return this._continueAfterResume(resumeToken, processTokenFacade, processModelFacade);
      case Runtime.Types.FlowNodeInstanceState.finished:
        const onExitToken: Runtime.Types.ProcessToken = getFlowNodeInstanceTokenByType(Runtime.Types.ProcessTokenType.onExit);

        return this._continueAfterExit(onExitToken, processTokenFacade, processModelFacade);
      case Runtime.Types.FlowNodeInstanceState.error:
        throw flowNodeInstance.error;
      case Runtime.Types.FlowNodeInstanceState.terminated:
        throw new InternalServerError(`Cannot resume UserTask instance ${flowNodeInstance.id}, because it was terminated!`);
      default:
        throw new InternalServerError(`Cannot resume UserTask instance ${flowNodeInstance.id}, because its state cannot be determined!`);
    }
  }

  protected async _continueAfterEnter(onEnterToken: Runtime.Types.ProcessToken,
                                      processTokenFacade: IProcessTokenFacade,
                                      processModelFacade: IProcessModelFacade,
                                     ): Promise<NextFlowNodeInfo> {

    await this.persistOnSuspend(onEnterToken);

    return this._executeHandler(onEnterToken, processTokenFacade, processModelFacade);
  }

  /**
   * Resumes the given FlowNodeInstance from the point where it assumed the
   * "onSuspended" state.
   *
   * When the FlowNodeInstance was interrupted during this stage, we need to resubscribe
   * to the EventHandler and wait for the UserTasks result.
   *
   * @async
   * @param   onSuspendToken     The token the FlowNodeInstance had when it was
   *                             suspended.
   * @param   processTokenFacade The ProcessTokenFacade to use for resuming.
   * @param   processModelFacade The processModelFacade to use for resuming.
   * @returns                    The Info for the next FlowNode to run.
   */
  private async _continueAfterSuspend(onSuspendToken: Runtime.Types.ProcessToken,
                                      processTokenFacade: IProcessTokenFacade,
                                      processModelFacade: IProcessModelFacade,
                                     ): Promise<NextFlowNodeInfo> {

    return this._executeHandler(onSuspendToken, processTokenFacade, processModelFacade);
  }

  /**
   * Resumes the given FlowNodeInstance from the point where it assumed the
   * "onResumed" state.
   *
   * Basically, the UserTask was already finished.
   * The final result is only missing in the database.
   *
   * @async
   * @param   resumeToken        The ProcessToken stored after resuming the
   *                             FlowNodeInstance.
   * @param   processTokenFacade The ProcessTokenFacade to use for resuming.
   * @param   processModelFacade The processModelFacade to use for resuming.
   * @returns                    The Info for the next FlowNode to run.
   */
  private async _continueAfterResume(resumeToken: Runtime.Types.ProcessToken,
                                     processTokenFacade: IProcessTokenFacade,
                                     processModelFacade: IProcessModelFacade,
                                    ): Promise<NextFlowNodeInfo> {

    processTokenFacade.addResultForFlowNode(this.userTask.id, resumeToken.payload);
    await this.persistOnExit(resumeToken);

    this._sendUserTaskFinishedNotification(resumeToken);

    return this.getNextFlowNodeInfo(resumeToken, processTokenFacade, processModelFacade);
  }

  protected async _executeHandler(token: Runtime.Types.ProcessToken,
                                  processTokenFacade: IProcessTokenFacade,
                                  processModelFacade: IProcessModelFacade,
                                 ): Promise<NextFlowNodeInfo> {

    const userTaskResult: any = await this._waitForUserTaskResult(token);

    token.payload = userTaskResult;
    await this.persistOnResume(token);

    processTokenFacade.addResultForFlowNode(this.userTask.id, userTaskResult);

    await this.persistOnExit(token);
    this._sendUserTaskFinishedNotification(token);

    return this.getNextFlowNodeInfo(token, processTokenFacade, processModelFacade);
  }

  /**
   * Suspends the current handler and waits for a FinishUserTaskMessage.
   * Upon receiving the messsage, the handler will be resumed with the received
   * result set.
   *
   * @async
   * @param token Contains all relevant info the EventAggregator will need for
   *              creating the EventSubscription.
   * @returns     The recevied UserTask result.
   */
  private async _waitForUserTaskResult(token: Runtime.Types.ProcessToken): Promise<any> {

    return new Promise<any>(async(resolve: Function): Promise<void> => {

      const finishUserTaskEvent: string = this._getFinishUserTaskEventName(token.correlationId, token.processInstanceId);

      const subscription: ISubscription =
        this._eventAggregator.subscribeOnce(finishUserTaskEvent, async(message: FinishUserTaskMessage): Promise<void> => {

          const userTaskResult: any = {
            form_fields: message.result || null,
          };

          if (subscription) {
            subscription.dispose();
          }

          resolve(userTaskResult);
        });

      this._sendUserTaskReachedNotification(token);
    });
  }

  /**
   * Publishes a notification on the EventAggregator, informing about a new
   * suspended UserTask.
   *
   * @param token Contains all infos required for the Notification message.
   */
  private _sendUserTaskReachedNotification(token: Runtime.Types.ProcessToken): void {

    const message: UserTaskReachedMessage = new UserTaskReachedMessage(token.correlationId,
                                                                       token.processModelId,
                                                                       token.processInstanceId,
                                                                       this.userTask.id,
                                                                       this.flowNodeInstanceId,
                                                                       token.payload);

    this._eventAggregator.publish(eventAggregatorSettings.messagePaths.userTaskReached, message);
  }

  /**
   * Publishes notifications on the EventAggregator, informing that a UserTask
   * has received a result and finished execution.
   *
   * Two notifications will be send:
   * - A global notification that everybody can receive
   * - A notification specifically for this UserTask.
   *
   * @param token Contains all infos required for the Notification message.
   */
  private _sendUserTaskFinishedNotification(token: Runtime.Types.ProcessToken): void {

    const message: UserTaskFinishedMessage = new UserTaskFinishedMessage(token.payload,
                                                                         token.correlationId,
                                                                         token.processModelId,
                                                                         token.processInstanceId,
                                                                         this.userTask.id,
                                                                         this.flowNodeInstanceId,
                                                                         token.payload);

    // FlowNode-specific notification
    const userTaskFinishedEvent: string = this._getUserTaskFinishedEventName(token.correlationId, token.processInstanceId);
    this._eventAggregator.publish(userTaskFinishedEvent, message);

    // Global notification
    this._eventAggregator.publish(eventAggregatorSettings.messagePaths.userTaskFinished, message);
  }

  private _getFinishUserTaskEventName(correlationId: string, processInstanceId: string): string {

    const finishUserTaskEvent: string = eventAggregatorSettings.routePaths.finishUserTask
      .replace(eventAggregatorSettings.routeParams.correlationId, correlationId)
      .replace(eventAggregatorSettings.routeParams.processInstanceId, processInstanceId)
      .replace(eventAggregatorSettings.routeParams.flowNodeInstanceId, this.flowNodeInstanceId);

    return finishUserTaskEvent;
  }

  private _getUserTaskFinishedEventName(correlationId: string, processInstanceId: string): string {

    // FlowNode-specific notification
    const userTaskFinishedEvent: string = eventAggregatorSettings.routePaths.userTaskFinished
      .replace(eventAggregatorSettings.routeParams.correlationId, correlationId)
      .replace(eventAggregatorSettings.routeParams.processInstanceId, processInstanceId)
      .replace(eventAggregatorSettings.routeParams.flowNodeInstanceId, this.flowNodeInstanceId);

    return userTaskFinishedEvent;

  }
}
