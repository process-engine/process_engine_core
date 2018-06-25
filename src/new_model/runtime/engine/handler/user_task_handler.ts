import {IEventAggregator} from '@essential-projects/event_aggregator_contracts';
import {
  IExecutionContextFacade,
  IFlowNodeInstancePersistence,
  IProcessModelFacade,
  IProcessTokenFacade,
  Model,
  NextFlowNodeInfo,
  Runtime,
} from '@process-engine/process_engine_contracts';

import {FlowNodeHandler} from './index';

export class UserTaskHandler extends FlowNodeHandler<Model.Activities.UserTask> {

  private _eventAggregator: IEventAggregator = undefined;
  private _flowNodeInstancePersistence: IFlowNodeInstancePersistence = undefined;

  constructor(eventAggregator: IEventAggregator, flowNodeInstancePersistence: IFlowNodeInstancePersistence) {
    super();
    this._eventAggregator = eventAggregator;
    this._flowNodeInstancePersistence = flowNodeInstancePersistence;
  }

  private get eventAggregator(): IEventAggregator {
    return this._eventAggregator;
  }

  private get flowNodeInstancePersistence(): IFlowNodeInstancePersistence {
    return this._flowNodeInstancePersistence;
  }

  protected async executeInternally(userTask: Model.Activities.UserTask,
                                    token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    executionContextFacade: IExecutionContextFacade): Promise<NextFlowNodeInfo> {

    return new Promise<NextFlowNodeInfo>(async(resolve: Function): Promise<void> => {

      const userTaskInstanceId: string = super.createFlowNodeInstanceId();

      await this.flowNodeInstancePersistence.persistOnEnter(token, userTask.id, userTaskInstanceId);

      this.eventAggregator.subscribeOnce(`/processengine/node/${userTask.id}/finish`, async(message: any): Promise<void> => {

        await this.flowNodeInstancePersistence.resume(userTaskInstanceId);

        const userTaskResult: any = {
          form_fields: message.data.token,
        };

        processTokenFacade.addResultForFlowNode(userTask.id, userTaskResult);
        const nextNodeAfterUserTask: Model.Base.FlowNode = processModelFacade.getNextFlowNodeFor(userTask);

        await this.flowNodeInstancePersistence.persistOnExit(token, userTask.id, userTaskInstanceId);

        this._sendUserTaskFinishedToConsumerApi(userTask, executionContextFacade);

        resolve(new NextFlowNodeInfo(nextNodeAfterUserTask, token, processTokenFacade));
      });

      await this.flowNodeInstancePersistence.suspend(token, userTaskInstanceId);
    });

  }

  private _sendUserTaskFinishedToConsumerApi(userTask: Model.Activities.UserTask,
                                             executionContextFacade: IExecutionContextFacade): void {

    this.eventAggregator.publish(`/processengine/node/${userTask.id}/finished`, {});
  }
}
