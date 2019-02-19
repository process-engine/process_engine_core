import {IContainer} from 'addict-ioc';

import {UnprocessableEntityError} from '@essential-projects/errors_ts';

import {IFlowNodeHandler, IFlowNodeHandlerDedicatedFactory} from '@process-engine/process_engine_contracts';
import {Model} from '@process-engine/process_model.contracts';

import {FlowNodeHandler} from '../flow_node_handler';

export class IntermediateThrowEventFactory implements IFlowNodeHandlerDedicatedFactory<Model.Events.IntermediateThrowEvent> {

  private _container: IContainer;

  constructor(container: IContainer) {
    this._container = container;
  }

  public async create(flowNode: Model.Events.IntermediateThrowEvent): Promise<IFlowNodeHandler<Model.Events.IntermediateThrowEvent>> {

    if (flowNode.linkEventDefinition) {
      return this
        ._container
        .resolveAsync<FlowNodeHandler<Model.Events.IntermediateCatchEvent>>('IntermediateLinkThrowEventHandler', [flowNode]);
    }

    if (flowNode.messageEventDefinition) {
      return this._container.resolveAsync<FlowNodeHandler<Model.Events.IntermediateCatchEvent>>('IntermediateMessageThrowEventHandler', [flowNode]);
    }

    if (flowNode.signalEventDefinition) {
      return this._container.resolveAsync<FlowNodeHandler<Model.Events.IntermediateCatchEvent>>('IntermediateSignalThrowEventHandler', [flowNode]);
    }

    throw new UnprocessableEntityError(`The IntermediateThrowEventType used with FlowNode ${flowNode.id} is not supported!`);
  }
}
