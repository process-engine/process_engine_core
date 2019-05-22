import {IContainer} from 'addict-ioc';

import {IFlowNodeHandler, IFlowNodeHandlerDedicatedFactory} from '@process-engine/process_engine_contracts';
import {Model} from '@process-engine/process_model.contracts';

import {ActivityHandler} from '../activity_handler';

export class ServiceTaskFactory implements IFlowNodeHandlerDedicatedFactory<Model.Activities.ServiceTask> {

  private container: IContainer;

  constructor(container: IContainer) {
    this.container = container;
  }

  public async create(flowNode: Model.Activities.ServiceTask): Promise<IFlowNodeHandler<Model.Activities.ServiceTask>> {

    if (flowNode.type === Model.Activities.ServiceTaskType.external) {
      return this.container.resolveAsync<ActivityHandler<Model.Activities.ServiceTask>>('ExternalServiceTaskHandler', [flowNode]);
    }

    return this.container.resolveAsync<ActivityHandler<Model.Activities.ServiceTask>>('InternalServiceTaskHandler', [flowNode]);
  }

}
