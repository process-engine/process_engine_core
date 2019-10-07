import {IContainer} from 'addict-ioc';

import {Model} from '@process-engine/persistence_api.contracts';
import {IFlowNodeHandler, IFlowNodeHandlerDedicatedFactory} from '@process-engine/process_engine_contracts';

import {EventHandler} from './index';

export class IntermediateCatchEventFactory implements IFlowNodeHandlerDedicatedFactory<Model.Events.IntermediateCatchEvent> {

  private container: IContainer;

  constructor(container: IContainer) {
    this.container = container;
  }

  public async create(flowNode: Model.Events.IntermediateCatchEvent): Promise<IFlowNodeHandler<Model.Events.IntermediateCatchEvent>> {

    if (flowNode.linkEventDefinition) {
      return this
        .container
        .resolveAsync<EventHandler<Model.Events.IntermediateCatchEvent>>('IntermediateLinkCatchEventHandler', [flowNode]);
    }

    if (flowNode.messageEventDefinition) {
      return this
        .container
        .resolveAsync<EventHandler<Model.Events.IntermediateCatchEvent>>('IntermediateMessageCatchEventHandler', [flowNode]);
    }

    if (flowNode.signalEventDefinition) {
      return this
        .container
        .resolveAsync<EventHandler<Model.Events.IntermediateCatchEvent>>('IntermediateSignalCatchEventHandler', [flowNode]);
    }

    if (flowNode.timerEventDefinition) {
      return this
        .container
        .resolveAsync<EventHandler<Model.Events.IntermediateCatchEvent>>('IntermediateTimerCatchEventHandler', [flowNode]);
    }

    return this
      .container
      .resolveAsync<EventHandler<Model.Events.IntermediateCatchEvent>>('IntermediateEmptyEventHandler', [flowNode]);
  }

}
