import {IEventAggregator, ISubscription} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';

import {IMetricsApi} from '@process-engine/metrics_api_contracts';
import {
  IFlowNodeInstanceService,
  IProcessModelFacade,
  IProcessTokenFacade,
  Model,
  NextFlowNodeInfo,
  Runtime,
} from '@process-engine/process_engine_contracts';

import {FlowNodeHandler} from './index';

export class UserTaskHandler extends FlowNodeHandler<Model.Activities.UserTask> {

  private _eventAggregator: IEventAggregator;

  constructor(eventAggregator: IEventAggregator, flowNodeInstanceService: IFlowNodeInstanceService, metricsService: IMetricsApi) {
    super(flowNodeInstanceService, metricsService);
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

      const finishEvent: string =
        `/processengine/correlation/${token.correlationId}/processinstance/${token.processInstanceId}/node/${userTask.id}`;

      const subscription: ISubscription =
        this.eventAggregator.subscribeOnce(`${finishEvent}/finish`, async(message: any): Promise<void> => {

          await this.persistOnResume(userTask, token);

          const userTaskResult: any = {
            form_fields: message.data.token === undefined ? null : message.data.token,
          };

          processTokenFacade.addResultForFlowNode(userTask.id, userTaskResult);
          token.payload = userTaskResult;

          const nextNodeAfterUserTask: Model.Base.FlowNode = processModelFacade.getNextFlowNodeFor(userTask);

          await this.persistOnExit(userTask, token);

          this._sendUserTaskFinishedToConsumerApi(finishEvent);

          if (subscription) {
            subscription.dispose();
          }

          resolve(new NextFlowNodeInfo(nextNodeAfterUserTask, token, processTokenFacade));
        });

      await this.persistOnSuspend(userTask, token);
    });

  }

  private _sendUserTaskFinishedToConsumerApi(finishEvent: string): void {

    this.eventAggregator.publish(`${finishEvent}/finished`, {});
  }
}
