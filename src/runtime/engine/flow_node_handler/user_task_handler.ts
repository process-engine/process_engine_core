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
              metricsService: IMetricsApi) {
    super(flowNodeInstanceService, loggingApiService, metricsService);
    this._eventAggregator = eventAggregator;
  }

  private get eventAggregator(): IEventAggregator {
    return this._eventAggregator;
  }

  protected async executeInternally(userTask: Model.Activities.UserTask,
                                    token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    identity: IIdentity): Promise<NextFlowNodeInfo> {

    return new Promise<NextFlowNodeInfo>(async(resolve: Function): Promise<void> => {

      await this.persistOnEnter(userTask, token);

      const finishUserTaskEvent: string = eventAggregatorSettings.routePaths.finishUserTask
        .replace(eventAggregatorSettings.routeParams.correlationId, token.correlationId)
        .replace(eventAggregatorSettings.routeParams.processModelId, token.processModelId)
        .replace(eventAggregatorSettings.routeParams.userTaskId, userTask.id);

      const subscription: ISubscription =
        this.eventAggregator.subscribeOnce(finishUserTaskEvent, async(message: FinishUserTaskMessage): Promise<void> => {

          await this.persistOnResume(userTask, token);

          const userTaskResult: any = {
            form_fields: message.result === undefined ? null : message.result,
          };

          processTokenFacade.addResultForFlowNode(userTask.id, userTaskResult);
          token.payload = userTaskResult;

          const nextNodeAfterUserTask: Model.Base.FlowNode = processModelFacade.getNextFlowNodeFor(userTask);

          await this.persistOnExit(userTask, token);

          this._sendUserTaskFinishedToConsumerApi(userTask.id, token, userTaskResult);

          if (subscription) {
            subscription.dispose();
          }

          resolve(new NextFlowNodeInfo(nextNodeAfterUserTask, token, processTokenFacade));
        });

      await this.persistOnSuspend(userTask, token);
      this._sendUserTaskWaitingToConsumerApi(userTask.id, token);
    });

  }

  private _sendUserTaskWaitingToConsumerApi(userTaskId: string, token: Runtime.Types.ProcessToken): void {

    const message: UserTaskReachedMessage = new UserTaskReachedMessage(token.correlationId,
                                                                       token.processModelId,
                                                                       token.processInstanceId,
                                                                       userTaskId,
                                                                       this.flowNodeInstanceId,
                                                                       token.payload);

    this.eventAggregator.publish(eventAggregatorSettings.messagePaths.userTaskReached, message);
  }

  private _sendUserTaskFinishedToConsumerApi(userTaskId: string,
                                             token: Runtime.Types.ProcessToken,
                                             userTaskResult: UserTaskResult): void {

    const message: UserTaskFinishedMessage = new UserTaskFinishedMessage(userTaskResult,
                                                                         token.correlationId,
                                                                         token.processModelId,
                                                                         token.processInstanceId,
                                                                         userTaskId,
                                                                         this.flowNodeInstanceId,
                                                                         token.payload);

    const userTaskFinishedEvent: string = eventAggregatorSettings.routePaths.userTaskFinished
      .replace(eventAggregatorSettings.routeParams.correlationId, token.correlationId)
      .replace(eventAggregatorSettings.routeParams.processModelId, token.processModelId)
      .replace(eventAggregatorSettings.routeParams.userTaskId, userTaskId);

    this.eventAggregator.publish(userTaskFinishedEvent, message);
  }
}
