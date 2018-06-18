import { IEvent, IEventAggregator } from '@essential-projects/event_aggregator_contracts';
import { IExecutionContextFacade, IFlowNodeHandlerFactory, IProcessModelFacade, IFlowNodeInstancePersistance,
  IProcessTokenFacade, Model, NextFlowNodeInfo, Runtime} from '@process-engine/process_engine_contracts';
import { FlowNodeHandler } from './index';

export class UserTaskHandler extends FlowNodeHandler<Model.Activities.UserTask> {

  private _eventAggregator: IEventAggregator = undefined;
  private _flowNodeInstancePersistance: IFlowNodeInstancePersistance = undefined;

  constructor(eventAggregator: IEventAggregator, flowNodeInstancePersistance: IFlowNodeInstancePersistance) {
    super();
    this._eventAggregator = eventAggregator;
    this._flowNodeInstancePersistance = flowNodeInstancePersistance;
  }

  private get eventAggregator(): IEventAggregator {
    return this._eventAggregator;
  }

  private get flowNodeInstancePersistance(): IFlowNodeInstancePersistance {
    return this._flowNodeInstancePersistance;
  }

  protected async executeInternally(userTask: Model.Activities.UserTask,
                                    token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    executionContextFacade: IExecutionContextFacade): Promise<NextFlowNodeInfo> {

    return new Promise<NextFlowNodeInfo>(async (resolve: Function): Promise<void> => {

      const userTaskInstanceId: string = super.createFlowNodeInstanceId();

      await this.flowNodeInstancePersistance.persistOnEnter(token, userTask.id, userTaskInstanceId);

      this.eventAggregator.subscribeOnce(`/processengine/node/${userTask.id}`, async(message: any): Promise<void> => {

        await this.flowNodeInstancePersistance.resume(userTaskInstanceId);

        const userTaskResult: any = {
          form_fields: message.data.token,
        };
        
        const newToken: Runtime.Types.ProcessToken = processTokenFacade.createProcessToken(userTaskResult);
        processTokenFacade.addResultForFlowNode(userTask.id, userTaskResult);
        const nextNodeAfterUserTask: Model.Base.FlowNode = processModelFacade.getNextFlowNodeFor(userTask);
        
        await this.flowNodeInstancePersistance.persistOnExit(newToken, userTask.id, userTaskInstanceId);

        this._sendUserTaskFinishedToConsumerApi(userTask, executionContextFacade);

        resolve(new NextFlowNodeInfo(nextNodeAfterUserTask, newToken, processTokenFacade));
      });

      await this.flowNodeInstancePersistance.suspend(token, userTaskInstanceId);
    });

  }

  private _sendUserTaskFinishedToConsumerApi(userTask: Model.Activities.UserTask,
                                             executionContextFacade: IExecutionContextFacade): void {

    this.eventAggregator.publish(`/processengine/node/${userTask.id}`, {
      data: {
        action: 'changeState',
        data: 'end',
      },
      metadata: {
        context: executionContextFacade.getExecutionContext(),
      },
    });
  }
}
