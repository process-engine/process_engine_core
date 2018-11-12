import {IEventAggregator, ISubscription} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';

import {ILoggingApi} from '@process-engine/logging_api_contracts';
import {IMetricsApi} from '@process-engine/metrics_api_contracts';
import {
  eventAggregatorSettings,
  IFlowNodeInstanceService,
  IProcessModelFacade,
  IProcessTokenFacade,
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
              metricsService: IMetricsApi) {
    super(flowNodeInstanceService, loggingApiService, metricsService);
    this._eventAggregator = eventAggregator;
  }

  private get eventAggregator(): IEventAggregator {
    return this._eventAggregator;
  }

  protected async executeInternally(manualTask: Model.Activities.ManualTask,
                                    token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    identity: IIdentity): Promise<NextFlowNodeInfo> {

    return new Promise<NextFlowNodeInfo>(async(resolve: Function): Promise<void> => {

      await this.persistOnEnter(manualTask, token);

      const finishManualTaskEvent: string = eventAggregatorSettings.routePaths.finishManualTask
        .replace(eventAggregatorSettings.routeParams.correlationId, token.correlationId)
        .replace(eventAggregatorSettings.routeParams.processModelId, token.processModelId)
        .replace(eventAggregatorSettings.routeParams.manualTaskId, manualTask.id);

      const subscription: ISubscription =
        this.eventAggregator.subscribeOnce(finishManualTaskEvent, async(message: FinishManualTaskMessage): Promise<void> => {

          await this.persistOnResume(manualTask, token);

          // const manualTaskResult: null = null;

          // processTokenFacade.addResultForFlowNode(manualTask.id, manualTaskResult);
          token.payload = null;

          const nextNodeAfterManualTask: Model.Base.FlowNode = processModelFacade.getNextFlowNodeFor(manualTask);

          await this.persistOnExit(manualTask, token);

          this._sendManualTaskFinishedToConsumerApi(manualTask.id, token);

          if (subscription) {
            subscription.dispose();
          }

          resolve(new NextFlowNodeInfo(nextNodeAfterManualTask, token, processTokenFacade));
        });

      await this.persistOnSuspend(manualTask, token);
      this._sendManualTaskWaitingToConsumerApi(manualTask.id, token);
    });

  }

  private _sendManualTaskWaitingToConsumerApi(manualTaskId: string, token: Runtime.Types.ProcessToken): void {

    const message: ManualTaskReachedMessage = new ManualTaskReachedMessage(token.correlationId,
                                                                       token.processModelId,
                                                                       token.processInstanceId,
                                                                       manualTaskId,
                                                                       this.flowNodeInstanceId,
                                                                       token.payload);

    this.eventAggregator.publish(eventAggregatorSettings.messagePaths.manualTaskReached, message);
  }

  private _sendManualTaskFinishedToConsumerApi(manualTaskId: string,
                                               token: Runtime.Types.ProcessToken): void {

    const message: ManualTaskFinishedMessage = new ManualTaskFinishedMessage(token.correlationId,
                                                                         token.processModelId,
                                                                         token.processInstanceId,
                                                                         manualTaskId,
                                                                         this.flowNodeInstanceId,
                                                                         token.payload);

    // FlowNode-specific notification
    const manualTaskFinishedEvent: string = eventAggregatorSettings.routePaths.manualTaskFinished
      .replace(eventAggregatorSettings.routeParams.correlationId, token.correlationId)
      .replace(eventAggregatorSettings.routeParams.processModelId, token.processModelId)
      .replace(eventAggregatorSettings.routeParams.manualTaskId, manualTaskId);

    this.eventAggregator.publish(manualTaskFinishedEvent, message);

    // Global notification
    this.eventAggregator.publish(eventAggregatorSettings.messagePaths.manualTaskFinished, message);
  }
}
