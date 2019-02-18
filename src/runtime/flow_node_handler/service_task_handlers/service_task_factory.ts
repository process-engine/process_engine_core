import {IContainer} from 'addict-ioc';

import {
  IFlowNodeHandler,
  IFlowNodeHandlerDedicatedFactory,
  Model,
} from '@process-engine/process_engine_contracts';

import {FlowNodeHandlerInterruptible} from '../flow_node_handler_interruptible';

export class ServiceTaskFactory implements IFlowNodeHandlerDedicatedFactory<Model.Activities.ServiceTask> {

  private _container: IContainer;

  constructor(container: IContainer) {
    this._container = container;
  }

  public async create(flowNode: Model.Activities.ServiceTask): Promise<IFlowNodeHandler<Model.Activities.ServiceTask>> {

    if (flowNode.type === Model.Activities.ServiceTaskType.external) {
      return this._container.resolveAsync<FlowNodeHandlerInterruptible<Model.Activities.ServiceTask>>('ExternalServiceTaskHandler', [flowNode]);
    }

    return this._container.resolveAsync<FlowNodeHandlerInterruptible<Model.Activities.ServiceTask>>('InternalServiceTaskHandler', [flowNode]);
  }
}
