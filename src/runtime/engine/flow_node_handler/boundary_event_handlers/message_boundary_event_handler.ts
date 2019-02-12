import {IEventAggregator, Subscription} from '@essential-projects/event_aggregator_contracts';
import {
  eventAggregatorSettings,
  IFlowNodePersistenceFacade,
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

  constructor(
    flowNodePersistenceFacade: IFlowNodePersistenceFacade,
    eventAggregator: IEventAggregator,
    boundaryEventModel: Model.Events.BoundaryEvent,
  ) {
    super(flowNodePersistenceFacade, boundaryEventModel);
    this._eventAggregator = eventAggregator;
  }

  public async waitForTriggeringEvent(
    onTriggeredCallback: OnBoundaryEventTriggeredCallback,
    token: Runtime.Types.ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    attachedFlowNodeInstanceId: string,
  ): Promise<void> {

    this._attachedFlowNodeInstanceId = attachedFlowNodeInstanceId;

    await this.persistOnEnter(token);

    const messageBoundaryEventName: string = eventAggregatorSettings.messagePaths.messageEventReached
      .replace(eventAggregatorSettings.messageParams.messageReference, this.boundaryEvent.messageEventDefinition.name);

    const messageReceivedCallback: any = async(message: MessageEventReachedMessage): Promise<void> => {

      const nextFlowNode: Model.Base.FlowNode = this.getNextFlowNode(processModelFacade);

      const eventData: OnBoundaryEventTriggeredData = {
        nextFlowNode: nextFlowNode,
        interruptHandler: this.boundaryEvent.cancelActivity,
        eventPayload: message.currentToken,
      };

      return onTriggeredCallback(eventData);
    };

    this.subscription = this._eventAggregator.subscribeOnce(messageBoundaryEventName, messageReceivedCallback);
  }

  public async cancel(token: Runtime.Types.ProcessToken, processModelFacade: IProcessModelFacade): Promise<void> {
    await super.cancel(token, processModelFacade);
    this._eventAggregator.unsubscribe(this.subscription);
  }
}
