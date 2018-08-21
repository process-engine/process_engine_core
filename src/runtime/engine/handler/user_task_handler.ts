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

  protected async executeInternally(flowNodeInfo: NextFlowNodeInfo<Model.Activities.UserTask>,
                                    token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    executionContextFacade: IExecutionContextFacade): Promise<NextFlowNodeInfo<Model.Base.FlowNode>> {

    return new Promise<NextFlowNodeInfo<Model.Base.FlowNode>>(async(resolve: Function): Promise<void> => {

      const flowNodeInstanceId: string = super.createFlowNodeInstanceId();
      const flowNode: Model.Activities.UserTask = flowNodeInfo.flowNode;

      await this.flowNodeInstanceService.persistOnEnter(executionContextFacade, token, flowNode.id, flowNodeInstanceId);

      this.eventAggregator.subscribeOnce(`/processengine/node/${flowNode.id}/finish`, async(message: any): Promise<void> => {

        await this.flowNodeInstanceService.resume(executionContextFacade, flowNodeInstanceId);

        const userTaskResult: any = {
          form_fields: message.data.token === undefined ? null : message.data.token,
        };

        processTokenFacade.addResultForFlowNode(flowNode.id, userTaskResult);
        token.payload = userTaskResult;

        const nextNodeAfterUserTask: Model.Base.FlowNode = processModelFacade.getNextFlowNodeFor(flowNode);

        await this.flowNodeInstanceService.persistOnExit(executionContextFacade, token, flowNode.id, flowNodeInstanceId);

        this._sendUserTaskFinishedToConsumerApi(flowNode, executionContextFacade);

        resolve(new NextFlowNodeInfo(nextNodeAfterUserTask, token, processTokenFacade));
      });

      await this.flowNodeInstanceService.suspend(executionContextFacade, token, flowNodeInstanceId);
    });

  }

  private _sendUserTaskFinishedToConsumerApi(userTask: Model.Activities.UserTask,
                                             executionContextFacade: IExecutionContextFacade): void {

    this.eventAggregator.publish(`/processengine/node/${userTask.id}/finished`, {});
  }
}
