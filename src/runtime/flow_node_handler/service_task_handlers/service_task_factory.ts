import {IContainer} from 'addict-ioc';

import {IFlowNodeHandler, IFlowNodeHandlerDedicatedFactory} from '@process-engine/process_engine_contracts';
import {Model} from '@process-engine/process_model.contracts';

import {FlowNodeHandler} from '../flow_node_handler';

export class ServiceTaskFactory implements IFlowNodeHandlerDedicatedFactory<Model.Activities.ServiceTask> {

  private _container: IContainer;

  constructor(container: IContainer) {
    this._container = container;
  }

  public async create(flowNode: Model.Activities.ServiceTask): Promise<IFlowNodeHandler<Model.Activities.ServiceTask>> {

    if (flowNode.type === Model.Activities.ServiceTaskType.external) {
      return this._container.resolveAsync<FlowNodeHandler<Model.Activities.ServiceTask>>('ExternalServiceTaskHandler', [flowNode]);
    }

    return this._container.resolveAsync<FlowNodeHandler<Model.Activities.ServiceTask>>('InternalServiceTaskHandler', [flowNode]);
  }
}
