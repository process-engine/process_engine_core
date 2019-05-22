import {InternalServerError} from '@essential-projects/errors_ts';

import {IBoundaryEventHandler, IBoundaryEventHandlerFactory} from '@process-engine/process_engine_contracts';
import {Model} from '@process-engine/process_model.contracts';

import {IContainer} from 'addict-ioc';

enum BoundaryEventType {
  Error = 'ErrorBoundaryEvent',
  Timer = 'TimerBoundaryEvent',
  Message = 'MessageBoundaryEvent',
  Signal = 'SignalBoundaryEvent',
}

export class BoundaryEventHandlerFactory implements IBoundaryEventHandlerFactory {

  private container: IContainer;

  constructor(container: IContainer) {
    this.container = container;
  }

  public async create(boundaryEventNode: Model.Events.BoundaryEvent): Promise<IBoundaryEventHandler> {
    const boundaryEventType = this.getEventDefinitionType(boundaryEventNode);

    switch (boundaryEventType) {
      case BoundaryEventType.Error:
        return this.resolveHandlerInstance('ErrorBoundaryEventHandler', boundaryEventNode);
      case BoundaryEventType.Message:
        return this.resolveHandlerInstance('MessageBoundaryEventHandler', boundaryEventNode);
      case BoundaryEventType.Signal:
        return this.resolveHandlerInstance('SignalBoundaryEventHandler', boundaryEventNode);
      case BoundaryEventType.Timer:
        return this.resolveHandlerInstance('TimerBoundaryEventHandler', boundaryEventNode);
      default:
        throw Error(`Invalid definition on BoundaryEvent ${boundaryEventNode.id} detected!`);
    }
  }

  private async resolveHandlerInstance(
    handlerRegistrationKey: string,
    flowNode: Model.Events.BoundaryEvent,
  ): Promise<IBoundaryEventHandler> {

    const handlerIsNotRegistered = !this.container.isRegistered(handlerRegistrationKey);
    if (handlerIsNotRegistered) {
      throw new InternalServerError(`No BoundaryEventHandler named "${handlerRegistrationKey}" is registered at the ioc container!`);
    }

    return this.container.resolveAsync<IBoundaryEventHandler>(handlerRegistrationKey, [flowNode]);
  }

  private getEventDefinitionType(boundaryEventNode: Model.Events.BoundaryEvent): BoundaryEventType {
    if (boundaryEventNode.errorEventDefinition) {
      return BoundaryEventType.Error;
    }

    if (boundaryEventNode.messageEventDefinition) {
      return BoundaryEventType.Message;
    }

    if (boundaryEventNode.signalEventDefinition) {
      return BoundaryEventType.Signal;
    }

    if (boundaryEventNode.timerEventDefinition) {
      return BoundaryEventType.Timer;
    }

    return undefined;
  }

}
