import {IContainer} from 'addict-ioc';

import {UnprocessableEntityError} from '@essential-projects/errors_ts';
import {
  IFlowNodeHandler,
  IFlowNodeHandlerDedicatedFactory,
  Model,
} from '@process-engine/process_engine_contracts';

import {FlowNodeHandlerInterruptible} from '../flow_node_handler_interruptible';

export class IntermediateCatchEventFactory implements IFlowNodeHandlerDedicatedFactory<Model.Events.IntermediateCatchEvent> {

  private _container: IContainer;

  constructor(container: IContainer) {
    this._container = container;
  }

  public async create(flowNode: Model.Events.IntermediateCatchEvent): Promise<IFlowNodeHandler<Model.Events.IntermediateCatchEvent>> {

    if (flowNode.linkEventDefinition) {
      return this
        ._container
        .resolve<FlowNodeHandlerInterruptible<Model.Events.IntermediateCatchEvent>>('IntermediateLinkCatchEventHandler', [flowNode]);
    }

    if (flowNode.messageEventDefinition) {
      return this
        ._container
        .resolve<FlowNodeHandlerInterruptible<Model.Events.IntermediateCatchEvent>>('IntermediateMessageCatchEventHandler', [flowNode]);
    }

    if (flowNode.signalEventDefinition) {
      return this
        ._container
        .resolve<FlowNodeHandlerInterruptible<Model.Events.IntermediateCatchEvent>>('IntermediateSignalCatchEventHandler', [flowNode]);
    }

    if (flowNode.timerEventDefinition) {
      return this
        ._container
        .resolve<FlowNodeHandlerInterruptible<Model.Events.IntermediateCatchEvent>>('IntermediateTimerCatchEventHandler', [flowNode]);
    }

    throw new UnprocessableEntityError(`The IntermediateCatchEventType used with FlowNode ${flowNode.id} is not supported!`);
  }
}
