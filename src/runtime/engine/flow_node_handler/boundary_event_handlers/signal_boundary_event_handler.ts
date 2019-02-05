import {IEventAggregator, Subscription} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';
import {
  eventAggregatorSettings,
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

  constructor(eventAggregator: IEventAggregator, processModelFacade: IProcessModelFacade, boundaryEventModel: Model.Events.BoundaryEvent) {
    super(processModelFacade, boundaryEventModel);
    this._eventAggregator = eventAggregator;
  }

  public async waitForTriggeringEvent(
    token: Runtime.Types.ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    identity: IIdentity,
    onTriggeredCallback: OnBoundaryEventTriggeredCallback,
  ): Promise<void> {

    const signalBoundaryEventName: string = eventAggregatorSettings.messagePaths.signalEventReached
      .replace(eventAggregatorSettings.messageParams.signalReference, this.boundaryEventModel.signalEventDefinition.name);

    const messageReceivedCallback: any = async(signal: SignalEventReachedMessage): Promise<void> => {

      const nextFlowNode: Model.Base.FlowNode = this.getNextFlowNode();

      const eventData: OnBoundaryEventTriggeredData = {
        nextFlowNode: nextFlowNode,
        interruptHandler: this.boundaryEventModel.cancelActivity,
        eventPayload: signal.currentToken,
      };

      return onTriggeredCallback(eventData);
    };

    this.subscription = this._eventAggregator.subscribeOnce(signalBoundaryEventName, messageReceivedCallback);
  }

  public async cancel(): Promise<void> {
    this._eventAggregator.unsubscribe(this.subscription);
  }
}
