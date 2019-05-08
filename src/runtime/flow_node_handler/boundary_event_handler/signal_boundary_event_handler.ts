import {IEventAggregator, Subscription} from '@essential-projects/event_aggregator_contracts';

import {ProcessToken} from '@process-engine/flow_node_instance.contracts';
import {
  IFlowNodePersistenceFacade,
  IProcessModelFacade,
  IProcessTokenFacade,
  OnBoundaryEventTriggeredCallback,
  SignalEventReachedMessage,
  eventAggregatorSettings,
} from '@process-engine/process_engine_contracts';
import {Model} from '@process-engine/process_model.contracts';

import {BoundaryEventHandler} from './boundary_event_handler';

export class SignalBoundaryEventHandler extends BoundaryEventHandler {

  private readonly eventAggregator: IEventAggregator;

  private subscription: Subscription;

  constructor(
    flowNodePersistenceFacade: IFlowNodePersistenceFacade,
    eventAggregator: IEventAggregator,
    boundaryEventModel: Model.Events.BoundaryEvent,
  ) {
    super(flowNodePersistenceFacade, boundaryEventModel);
    this.eventAggregator = eventAggregator;
  }

  public async waitForTriggeringEvent(
    onTriggeredCallback: OnBoundaryEventTriggeredCallback,
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    attachedFlowNodeInstanceId: string,
  ): Promise<void> {

    this.attachedFlowNodeInstanceId = attachedFlowNodeInstanceId;

    await this.persistOnEnter(token);

    const signalBoundaryEventName = eventAggregatorSettings.messagePaths.signalEventReached
      .replace(eventAggregatorSettings.messageParams.signalReference, this.boundaryEventModel.signalEventDefinition.name);

    const messageReceivedCallback = async (signal: SignalEventReachedMessage): Promise<void> => {

      const nextFlowNode = this.getNextFlowNode(processModelFacade);

      const eventData = {
        boundaryInstanceId: this.boundaryEventInstanceId,
        nextFlowNode: nextFlowNode,
        interruptHandler: this.boundaryEventModel.cancelActivity,
        eventPayload: signal.currentToken,
      };

      return onTriggeredCallback(eventData);
    };

    this.subscription = this.eventAggregator.subscribeOnce(signalBoundaryEventName, messageReceivedCallback);
  }

  public async cancel(token: ProcessToken, processModelFacade: IProcessModelFacade): Promise<void> {
    await super.cancel(token, processModelFacade);
    this.eventAggregator.unsubscribe(this.subscription);
  }

}
