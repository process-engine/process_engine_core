import {IContainer} from 'addict-ioc';

import {IFlowNodeHandler, IFlowNodeHandlerDedicatedFactory} from '@process-engine/process_engine_contracts';
import {Model} from '@process-engine/process_model.contracts';

import {EventHandler} from './index';

export class IntermediateCatchEventFactory implements IFlowNodeHandlerDedicatedFactory<Model.Events.IntermediateCatchEvent> {

  private _container: IContainer;

  constructor(container: IContainer) {
    this._container = container;
  }

  public async create(flowNode: Model.Events.IntermediateCatchEvent): Promise<IFlowNodeHandler<Model.Events.IntermediateCatchEvent>> {

    if (flowNode.linkEventDefinition) {
      return this
        ._container
        .resolveAsync<EventHandler<Model.Events.IntermediateCatchEvent>>('IntermediateLinkCatchEventHandler', [flowNode]);
    }

    if (flowNode.messageEventDefinition) {
      return this
        ._container
        .resolveAsync<EventHandler<Model.Events.IntermediateCatchEvent>>('IntermediateMessageCatchEventHandler', [flowNode]);
    }

    if (flowNode.signalEventDefinition) {
      return this
        ._container
        .resolveAsync<EventHandler<Model.Events.IntermediateCatchEvent>>('IntermediateSignalCatchEventHandler', [flowNode]);
    }

    if (flowNode.timerEventDefinition) {
      return this
        ._container
        .resolveAsync<EventHandler<Model.Events.IntermediateCatchEvent>>('IntermediateTimerCatchEventHandler', [flowNode]);
    }

    return this
      ._container
      .resolveAsync<EventHandler<Model.Events.IntermediateCatchEvent>>('IntermediateEmptyEventHandler', [flowNode]);
  }
}
