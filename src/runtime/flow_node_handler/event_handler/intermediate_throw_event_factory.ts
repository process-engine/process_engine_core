import {IContainer} from 'addict-ioc';

import {IFlowNodeHandler, IFlowNodeHandlerDedicatedFactory} from '@process-engine/process_engine_contracts';
import {Model} from '@process-engine/process_model.contracts';

import {EventHandler} from './index';

export class IntermediateThrowEventFactory implements IFlowNodeHandlerDedicatedFactory<Model.Events.IntermediateThrowEvent> {

  private container: IContainer;

  constructor(container: IContainer) {
    this.container = container;
  }

  public async create(flowNode: Model.Events.IntermediateThrowEvent): Promise<IFlowNodeHandler<Model.Events.IntermediateThrowEvent>> {

    if (flowNode.linkEventDefinition) {
      return this
        .container
        .resolveAsync<EventHandler<Model.Events.IntermediateCatchEvent>>('IntermediateLinkThrowEventHandler', [flowNode]);
    }

    if (flowNode.messageEventDefinition) {
      return this.container.resolveAsync<EventHandler<Model.Events.IntermediateCatchEvent>>('IntermediateMessageThrowEventHandler', [flowNode]);
    }

    if (flowNode.signalEventDefinition) {
      return this.container.resolveAsync<EventHandler<Model.Events.IntermediateCatchEvent>>('IntermediateSignalThrowEventHandler', [flowNode]);
    }

    return this
      .container
      .resolveAsync<EventHandler<Model.Events.IntermediateCatchEvent>>('IntermediateEmptyEventHandler', [flowNode]);
  }

}
