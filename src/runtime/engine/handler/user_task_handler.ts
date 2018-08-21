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

      this.eventAggregator.subscribeOnce(`/processengine/node/${userTask.id}/finish`, async(message: any): Promise<void> => {

        await this.flowNodeInstanceService.resume(userTask.id, this.flowNodeInstanceId, token);

        const userTaskResult: any = {
          form_fields: message.data.token === undefined ? null : message.data.token,
        };

        processTokenFacade.addResultForFlowNode(userTask.id, userTaskResult);
        token.payload = userTaskResult;

        const nextNodeAfterUserTask: Model.Base.FlowNode = processModelFacade.getNextFlowNodeFor(userTask);

        await this.flowNodeInstanceService.persistOnExit(userTask.id, this.flowNodeInstanceId, token);

        this._sendUserTaskFinishedToConsumerApi(userTask, executionContextFacade);

        resolve(new NextFlowNodeInfo(nextNodeAfterUserTask, token, processTokenFacade));
      });

      await this.flowNodeInstanceService.suspend(userTask.id, this.flowNodeInstanceId, token);
    });

  }

  private _sendUserTaskFinishedToConsumerApi(userTask: Model.Activities.UserTask,
                                             executionContextFacade: IExecutionContextFacade): void {

    this.eventAggregator.publish(`/processengine/node/${userTask.id}/finished`, {});
  }
}
