import {IEventAggregator, ISubscription} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';

import {ILoggingApi} from '@process-engine/logging_api_contracts';
import {IMetricsApi} from '@process-engine/metrics_api_contracts';
import {
  eventAggregatorSettings,
  FinishManualTaskMessage,
  IFlowNodeInstanceService,
  IProcessModelFacade,
  IProcessTokenFacade,
  ManualTaskFinishedMessage,
  ManualTaskReachedMessage,
  Model,
  NextFlowNodeInfo,
  Runtime,
} from '@process-engine/process_engine_contracts';

import {FlowNodeHandler} from './index';

export class ManualTaskHandler extends FlowNodeHandler<Model.Activities.ManualTask> {

  private _eventAggregator: IEventAggregator;

  constructor(eventAggregator: IEventAggregator,
              flowNodeInstanceService: IFlowNodeInstanceService,
              loggingApiService: ILoggingApi,
              metricsService: IMetricsApi,
              manualTaskModel: Model.Activities.ManualTask) {
    super(flowNodeInstanceService, loggingApiService, metricsService, manualTaskModel);
    this._eventAggregator = eventAggregator;
  }

  private get manualTask(): Model.Activities.ManualTask {
    return super.flowNode;
  }

  private get eventAggregator(): IEventAggregator {
    return this._eventAggregator;
  }

  protected async executeInternally(token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    identity: IIdentity): Promise<NextFlowNodeInfo> {

    return new Promise<NextFlowNodeInfo>(async(resolve: Function): Promise<void> => {

      await this.persistOnEnter(token);

      const finishManualTaskEvent: string = eventAggregatorSettings.routePaths.finishManualTask
        .replace(eventAggregatorSettings.routeParams.correlationId, token.correlationId)
        .replace(eventAggregatorSettings.routeParams.processInstanceId, token.processInstanceId)
        .replace(eventAggregatorSettings.routeParams.flowNodeInstanceId, this.flowNodeInstanceId);
      const subscription: ISubscription =
        this.eventAggregator.subscribeOnce(finishManualTaskEvent, async(message: FinishManualTaskMessage): Promise<void> => {

          await this.persistOnResume(token);

          // an empty object is used here because manual tasks do not yield any results
          processTokenFacade.addResultForFlowNode(this.manualTask.id, {});
          token.payload = {};

          const nextNodeAfterManualTask: Model.Base.FlowNode = processModelFacade.getNextFlowNodeFor(this.manualTask);

          await this.persistOnExit(token);

          this._sendManualTaskFinishedToConsumerApi(token);

          if (subscription) {
            subscription.dispose();
          }

          resolve(new NextFlowNodeInfo(nextNodeAfterManualTask, token, processTokenFacade));
        });

      await this.persistOnSuspend(token);
      this._sendManualTaskWaitingToConsumerApi(token);
    });

  }

  private _sendManualTaskWaitingToConsumerApi(token: Runtime.Types.ProcessToken): void {

    const message: ManualTaskReachedMessage = new ManualTaskReachedMessage(token.correlationId,
                                                                       token.processModelId,
                                                                       token.processInstanceId,
                                                                       this.manualTask.id,
                                                                       this.flowNodeInstanceId,
                                                                       token.payload);

    this.eventAggregator.publish(eventAggregatorSettings.messagePaths.manualTaskReached, message);
  }

  private _sendManualTaskFinishedToConsumerApi(token: Runtime.Types.ProcessToken): void {

    const message: ManualTaskFinishedMessage = new ManualTaskFinishedMessage(token.correlationId,
                                                                         token.processModelId,
                                                                         token.processInstanceId,
                                                                         this.manualTask.id,
                                                                         this.flowNodeInstanceId,
                                                                         token.payload);

    // FlowNode-specific notification
    const manualTaskFinishedEvent: string = eventAggregatorSettings.routePaths.manualTaskFinished
      .replace(eventAggregatorSettings.routeParams.correlationId, token.correlationId)
      .replace(eventAggregatorSettings.routeParams.processInstanceId, token.processInstanceId)
      .replace(eventAggregatorSettings.routeParams.flowNodeInstanceId, this.flowNodeInstanceId);
    this.eventAggregator.publish(manualTaskFinishedEvent, message);

    // Global notification
    this.eventAggregator.publish(eventAggregatorSettings.messagePaths.manualTaskFinished, message);
  }
}
