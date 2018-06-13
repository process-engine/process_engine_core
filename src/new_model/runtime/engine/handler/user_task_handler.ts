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
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    executionContextFacade: IExecutionContextFacade): Promise<NextFlowNodeInfo> {

    return new Promise<NextFlowNodeInfo>(async (resolve: Function): Promise<void> => {

      let processToken: Runtime.Types.ProcessToken = processTokenFacade.createProcessToken(userTask.id);

      const userTaskInstanceId: string = super.createFlowNodeInstanceId();

      await this.flowNodeInstancePersistance.persistOnEnter(processToken, userTask.id, userTaskInstanceId);

      this.eventAggregator.subscribeOnce(`/processengine/node/${userTask.id}`, async(message: any): Promise<void> => {

        await this.flowNodeInstancePersistance.resume(userTaskInstanceId);

        const userTaskResult: any = {
          form_fields: message.data.token,
        };
        
        processToken = processTokenFacade.createProcessToken(userTask.id, userTaskResult);
        processTokenFacade.addResultForFlowNode(userTask.id, userTaskResult);
        const nextNodeAfterUserTask: Model.Base.FlowNode = processModelFacade.getNextFlowNodeFor(userTask);
        
        await this.flowNodeInstancePersistance.persistOnExit(processToken, userTask.id, userTaskInstanceId);

        resolve(new NextFlowNodeInfo(nextNodeAfterUserTask, processTokenFacade));
      });

      await this.flowNodeInstancePersistance.suspend(processToken, userTaskInstanceId);
    });

  }
}
