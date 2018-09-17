import {IEventAggregator, ISubscription} from '@essential-projects/event_aggregator_contracts';
import {
  eventAggregatorSettings,
  IExecutionContextFacade,
  IFlowNodeInstanceService,
  IProcessModelFacade,
  IProcessTokenFacade,
  Model,
  NextFlowNodeInfo,
  Runtime,
  UserTaskFinishedMessage,
  FinishUserTaskMessage,
  UserTaskResult,
  UserTaskWaitingMessage,
} from '@process-engine/process_engine_contracts';

import {FlowNodeHandler} from './index';

export class UserTaskHandler extends FlowNodeHandler<Model.Activities.UserTask> {

  private _eventAggregator: IEventAggregator = undefined;
  private _flowNodeInstanceService: IFlowNodeInstanceService = undefined;

  constructor(eventAggregator: IEventAggregator, flowNodeInstanceService: IFlowNodeInstanceService) {
    super();
    this._eventAggregator = eventAggregator;
    this._flowNodeInstanceService = flowNodeInstanceService;
  }

  private get eventAggregator(): IEventAggregator {
    return this._eventAggregator;
  }

  private get flowNodeInstanceService(): IFlowNodeInstanceService {
    return this._flowNodeInstanceService;
  }

  protected async executeInternally(userTask: Model.Activities.UserTask,
                                    token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    executionContextFacade: IExecutionContextFacade): Promise<NextFlowNodeInfo> {

    return new Promise<NextFlowNodeInfo>(async(resolve: Function): Promise<void> => {

      await this.flowNodeInstanceService.persistOnEnter(userTask.id, this.flowNodeInstanceId, token);

      const finishUserTaskEvent: string = eventAggregatorSettings.routePaths.userTaskFinished
        .replace(eventAggregatorSettings.routeParams.correlationId, token.correlationId)
        .replace(eventAggregatorSettings.routeParams.processInstanceId, token.processInstanceId)
        .replace(eventAggregatorSettings.routeParams.userTaskId, userTask.id);

      const subscription: ISubscription =
        this.eventAggregator.subscribeOnce(finishUserTaskEvent, async(message: FinishUserTaskMessage): Promise<void> => {

          await this.flowNodeInstanceService.resume(userTask.id, this.flowNodeInstanceId, token);

          const userTaskResult: any = {
            form_fields: message.result === undefined ? null : message.result,
          };

          processTokenFacade.addResultForFlowNode(userTask.id, userTaskResult);
          token.payload = userTaskResult;

          const nextNodeAfterUserTask: Model.Base.FlowNode = processModelFacade.getNextFlowNodeFor(userTask);

          await this.flowNodeInstanceService.persistOnExit(userTask.id, this.flowNodeInstanceId, token);

          this._sendUserTaskFinishedToConsumerApi(token.correlationId, token.processInstanceId, userTask.id, userTaskResult);

          if (subscription) {
            subscription.dispose();
          }

          resolve(new NextFlowNodeInfo(nextNodeAfterUserTask, token, processTokenFacade));
        });

      await this.flowNodeInstanceService.suspend(userTask.id, this.flowNodeInstanceId, token);
      this._sendUserTaskWaitingToConsumerApi(token.correlationId, token.processInstanceId, userTask.id);
    });

  }

  private _sendUserTaskWaitingToConsumerApi(correlationId: string,
                                            processInstanceId: string,
                                            userTaskId: string): void {
    const message: UserTaskWaitingMessage = new UserTaskWaitingMessage();
    message.correlationId = correlationId;
    message.processInstanceId = processInstanceId;
    message.userTaskId = userTaskId;
    this.eventAggregator.publish(eventAggregatorSettings.messagePaths.userTaskWaiting, message);
  }

  private _sendUserTaskFinishedToConsumerApi(correlationId: string,
                                             processInstanceId: string,
                                             userTaskId: string,
                                             userTaskResult: UserTaskResult): void {
    const message: UserTaskFinishedMessage = new UserTaskFinishedMessage();
    message.correlationId = correlationId;
    message.processInstanceId = processInstanceId;
    message.userTaskId = userTaskId;
    message.userTaskResult = userTaskResult;
    this.eventAggregator.publish(eventAggregatorSettings.messagePaths.userTaskFinished, message);
  }
}
