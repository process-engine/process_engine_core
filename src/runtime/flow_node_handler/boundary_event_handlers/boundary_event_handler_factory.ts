import {InternalServerError} from '@essential-projects/errors_ts';
import {
  IBoundaryEventHandler,
  IBoundaryEventHandlerFactory,
  Model,
} from '@process-engine/process_engine_contracts';

import {IContainer} from 'addict-ioc';

enum BoundaryEventType {
  Error = 'ErrorBoundaryEvent',
  Timer = 'TimerBoundaryEvent',
  Message = 'MessageBoundaryEvent',
  Signal = 'SignalBoundaryEvent',
}

export class BoundaryEventHandlerFactory implements IBoundaryEventHandlerFactory {

  private _container: IContainer;

  constructor(container: IContainer) {
    this._container = container;
  }

  public async create(boundaryEventNode: Model.Events.BoundaryEvent): Promise<IBoundaryEventHandler> {
    const boundaryEventType: BoundaryEventType = this._getEventDefinitionType(boundaryEventNode);

    switch (boundaryEventType) {
      case BoundaryEventType.Error:
        return this._resolveHandlerInstance('ErrorBoundaryEventHandler', boundaryEventNode);
      case BoundaryEventType.Message:
        return this._resolveHandlerInstance('MessageBoundaryEventHandler', boundaryEventNode);
      case BoundaryEventType.Signal:
        return this._resolveHandlerInstance('SignalBoundaryEventHandler', boundaryEventNode);
      case BoundaryEventType.Timer:
        return this._resolveHandlerInstance('TimerBoundaryEventHandler', boundaryEventNode);
      default:
        throw Error(`Invalid definition on BoundaryEvent ${boundaryEventNode.id} detected!`);
    }
  }

  private async _resolveHandlerInstance(
    handlerRegistrationKey: string,
    flowNode: Model.Events.BoundaryEvent,
  ): Promise<IBoundaryEventHandler> {

    const handlerIsNotRegistered: boolean = !this._container.isRegistered(handlerRegistrationKey);
    if (handlerIsNotRegistered) {
      throw new InternalServerError(`No BoundaryEventHandler named "${handlerRegistrationKey}" is registered at the ioc container!`);
    }

    return this._container.resolveAsync<IBoundaryEventHandler>(handlerRegistrationKey, [flowNode]);
  }

  private _getEventDefinitionType(boundaryEventNode: Model.Events.BoundaryEvent): BoundaryEventType {
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
