import { IEvent, IEventAggregator } from '@essential-projects/event_aggregator_contracts';
import { IExecutionContextFacade, IFlowNodeHandlerFactory, IProcessModelFacade,
  IProcessTokenFacade, Model, NextFlowNodeInfo, Runtime} from '@process-engine/process_engine_contracts';
import { FlowNodeHandler } from './index';

export class UserTaskHandler extends FlowNodeHandler<Model.Activities.UserTask> {

  private _eventAggregator: IEventAggregator = undefined;

  constructor(eventAggregator: IEventAggregator) {
    super();
    this._eventAggregator = eventAggregator;
  }

  private get eventAggregator(): IEventAggregator {
    return this._eventAggregator;
  }

  protected async executeInternally(userTask: Model.Activities.UserTask,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    executionContextFacade: IExecutionContextFacade): Promise<NextFlowNodeInfo> {

    return new Promise<NextFlowNodeInfo>((resolve: Function): void => {

      this.eventAggregator.subscribeOnce(`/processengine/node/${userTask.id}`, (message: any) => {

        const userTaskResult: any = message.data.token;

        processTokenFacade.addResultForFlowNode(userTask.id, userTaskResult);

        const nextFlowNode: NextFlowNodeInfo = new NextFlowNodeInfo(undefined, processTokenFacade);
        resolve(nextFlowNode);
      });
    });

  }
}
