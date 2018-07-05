import {IEventAggregator} from '@essential-projects/event_aggregator_contracts';
import {
  IExecutionContextFacade,
  IFlowNodeInstanceService,
  IProcessModelFacade,
  IProcessTokenFacade,
  Model,
  NextFlowNodeInfo,
  Runtime,
} from '@process-engine/process_engine_contracts';

import {FlowNodeHandler} from './index';

export class UserTaskHandler extends FlowNodeHandler<Model.Activities.UserTask> {

  private _eventAggregator: IEventAggregator = undefined;
  private _flowNodeInstancePersistenceService: IFlowNodeInstanceService = undefined;

  constructor(eventAggregator: IEventAggregator, flowNodeInstancePersistenceService: IFlowNodeInstanceService) {
    super();
    this._eventAggregator = eventAggregator;
    this._flowNodeInstancePersistenceService = flowNodeInstancePersistenceService;
  }

  private get eventAggregator(): IEventAggregator {
    return this._eventAggregator;
  }

  private get flowNodeInstancePersistenceService(): IFlowNodeInstanceService {
    return this._flowNodeInstancePersistenceService;
  }

  protected async executeInternally(userTask: Model.Activities.UserTask,
                                    token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    executionContextFacade: IExecutionContextFacade): Promise<NextFlowNodeInfo> {

    return new Promise<NextFlowNodeInfo>(async(resolve: Function): Promise<void> => {

      const userTaskInstanceId: string = super.createFlowNodeInstanceId();

      await this.flowNodeInstancePersistenceService.persistOnEnter(executionContextFacade, token, userTask.id, userTaskInstanceId);

      this.eventAggregator.subscribeOnce(`/processengine/node/${userTask.id}/finish`, async(message: any): Promise<void> => {

        await this.flowNodeInstancePersistenceService.resume(executionContextFacade, userTaskInstanceId);

        const userTaskResult: any = {
          form_fields: message.data.token,
        };

        processTokenFacade.addResultForFlowNode(userTask.id, userTaskResult);
        const nextNodeAfterUserTask: Model.Base.FlowNode = processModelFacade.getNextFlowNodeFor(userTask);

        await this.flowNodeInstancePersistenceService.persistOnExit(executionContextFacade, token, userTask.id, userTaskInstanceId);

        this._sendUserTaskFinishedToConsumerApi(userTask, executionContextFacade);

        resolve(new NextFlowNodeInfo(nextNodeAfterUserTask, token, processTokenFacade));
      });

      await this.flowNodeInstancePersistenceService.suspend(executionContextFacade, token, userTaskInstanceId);
    });

  }

  private _sendUserTaskFinishedToConsumerApi(userTask: Model.Activities.UserTask,
                                             executionContextFacade: IExecutionContextFacade): void {

    this.eventAggregator.publish(`/processengine/node/${userTask.id}/finished`, {});
  }
}
