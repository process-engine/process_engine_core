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
  UserTaskResult,
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

    return new Promise<NextFlowNodeInfo>(async(resolve: Function): Promise<void> => {

      await this.persistOnEnter(token);

      const finishUserTaskEvent: string = eventAggregatorSettings.routePaths.finishUserTask
        .replace(eventAggregatorSettings.routeParams.correlationId, token.correlationId)
        .replace(eventAggregatorSettings.routeParams.processInstanceId, token.processInstanceId)
        .replace(eventAggregatorSettings.routeParams.flowNodeInstanceId, this.flowNodeInstanceId);

      const subscription: ISubscription =
        this._eventAggregator.subscribeOnce(finishUserTaskEvent, async(message: FinishUserTaskMessage): Promise<void> => {

          await this.persistOnResume(token);

          const userTaskResult: any = {
            form_fields: message.result === undefined ? null : message.result,
          };

          processTokenFacade.addResultForFlowNode(this.userTask.id, userTaskResult);
          token.payload = userTaskResult;

          const nextNodeAfterUserTask: Model.Base.FlowNode = processModelFacade.getNextFlowNodeFor(this.userTask);

          await this.persistOnExit(token);

          this._sendUserTaskFinishedToConsumerApi(token, userTaskResult);

          if (subscription) {
            subscription.dispose();
          }

          resolve(new NextFlowNodeInfo(nextNodeAfterUserTask, token, processTokenFacade));
        });

      await this.persistOnSuspend(token);
      this._sendUserTaskWaitingToConsumerApi(token);
    });
  }

  public async resumeInternally(flowNodeInstance: Runtime.Types.FlowNodeInstance,
                                processTokenFacade: IProcessTokenFacade,
                                processModelFacade: IProcessModelFacade,
                                identity: IIdentity,
                              ): Promise<NextFlowNodeInfo> {

    throw new Error('Not implemented yet.');
  }

  private _sendUserTaskWaitingToConsumerApi(token: Runtime.Types.ProcessToken): void {

    const message: UserTaskReachedMessage = new UserTaskReachedMessage(token.correlationId,
                                                                       token.processModelId,
                                                                       token.processInstanceId,
                                                                       this.userTask.id,
                                                                       this.flowNodeInstanceId,
                                                                       token.payload);

    this._eventAggregator.publish(eventAggregatorSettings.messagePaths.userTaskReached, message);
  }

  private _sendUserTaskFinishedToConsumerApi(token: Runtime.Types.ProcessToken,
                                             userTaskResult: UserTaskResult): void {

    const message: UserTaskFinishedMessage = new UserTaskFinishedMessage(userTaskResult,
                                                                         token.correlationId,
                                                                         token.processModelId,
                                                                         token.processInstanceId,
                                                                         this.userTask.id,
                                                                         this.flowNodeInstanceId,
                                                                         token.payload);

    // FlowNode-specific notification
    const userTaskFinishedEvent: string = eventAggregatorSettings.routePaths.userTaskFinished
      .replace(eventAggregatorSettings.routeParams.correlationId, token.correlationId)
      .replace(eventAggregatorSettings.routeParams.processInstanceId, token.processInstanceId)
      .replace(eventAggregatorSettings.routeParams.flowNodeInstanceId, this.flowNodeInstanceId);

    this._eventAggregator.publish(userTaskFinishedEvent, message);

    // Global notification
    this._eventAggregator.publish(eventAggregatorSettings.messagePaths.userTaskFinished, message);
  }
}
