import {IEventAggregator, Subscription} from '@essential-projects/event_aggregator_contracts';
import {
  eventAggregatorSettings,
  IFlowNodePersistenceFacade,
  IProcessModelFacade,
  IProcessTokenFacade,
  Model,
  OnBoundaryEventTriggeredCallback,
  OnBoundaryEventTriggeredData,
  Runtime,
  SignalEventReachedMessage,
} from '@process-engine/process_engine_contracts';

import {BoundaryEventHandler} from './boundary_event_handler';

export class SignalBoundaryEventHandler extends BoundaryEventHandler {

  private readonly _eventAggregator: IEventAggregator;

  private subscription: Subscription;

  constructor(
    flowNodePersistenceFacade: IFlowNodePersistenceFacade,
    eventAggregator: IEventAggregator,
    processModelFacade: IProcessModelFacade,
    boundaryEventModel: Model.Events.BoundaryEvent,
  ) {
    super(flowNodePersistenceFacade, processModelFacade, boundaryEventModel);
    this._eventAggregator = eventAggregator;
  }

  public async waitForTriggeringEvent(
    onTriggeredCallback: OnBoundaryEventTriggeredCallback,
    token: Runtime.Types.ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    attachedFlowNodeInstanceId: string,
  ): Promise<void> {

    this._attachedFlowNodeInstanceId = attachedFlowNodeInstanceId;

    await this.persistOnEnter(token);

    const signalBoundaryEventName: string = eventAggregatorSettings.messagePaths.signalEventReached
      .replace(eventAggregatorSettings.messageParams.signalReference, this.boundaryEvent.signalEventDefinition.name);

    const messageReceivedCallback: any = async(signal: SignalEventReachedMessage): Promise<void> => {

      const nextFlowNode: Model.Base.FlowNode = this.getNextFlowNode();

      const eventData: OnBoundaryEventTriggeredData = {
        nextFlowNode: nextFlowNode,
        interruptHandler: this.boundaryEvent.cancelActivity,
        eventPayload: signal.currentToken,
      };

      return onTriggeredCallback(eventData);
    };

    this.subscription = this._eventAggregator.subscribeOnce(signalBoundaryEventName, messageReceivedCallback);
  }

  public async cancel(token: Runtime.Types.ProcessToken): Promise<void> {
    await super.cancel(token);
    this._eventAggregator.unsubscribe(this.subscription);
  }
}
