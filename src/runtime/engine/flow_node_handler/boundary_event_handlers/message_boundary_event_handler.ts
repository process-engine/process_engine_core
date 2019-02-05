import {IEventAggregator, Subscription} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';
import {
  eventAggregatorSettings,
  IProcessModelFacade,
  IProcessTokenFacade,
  MessageEventReachedMessage,
  Model,
  OnBoundaryEventTriggeredCallback,
  OnBoundaryEventTriggeredData,
  Runtime,
} from '@process-engine/process_engine_contracts';

import {BoundaryEventHandler} from './boundary_event_handler';

export class MessageBoundaryEventHandler extends BoundaryEventHandler {

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

    const messageBoundaryEventName: string = eventAggregatorSettings.messagePaths.messageEventReached
      .replace(eventAggregatorSettings.messageParams.messageReference, this.boundaryEventModel.messageEventDefinition.name);

    const messageReceivedCallback: any = async(message: MessageEventReachedMessage): Promise<void> => {

      const nextFlowNode: Model.Base.FlowNode = this.getNextFlowNode();

      const eventData: OnBoundaryEventTriggeredData = {
        nextFlowNode: nextFlowNode,
        interruptHandler: this.boundaryEventModel.cancelActivity,
        eventPayload: message.currentToken,
      };

      return onTriggeredCallback(eventData);
    };

    this.subscription = this._eventAggregator.subscribeOnce(messageBoundaryEventName, messageReceivedCallback);
  }

  public async cancel(): Promise<void> {
    this._eventAggregator.unsubscribe(this.subscription);
  }
}
