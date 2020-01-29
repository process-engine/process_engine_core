import {Subscription} from '@essential-projects/event_aggregator_contracts';

import {FlowNodeInstance, ProcessToken} from '@process-engine/persistence_api.contracts';
import {
  IProcessModelFacade,
  IProcessTokenFacade,
  OnBoundaryEventTriggeredCallback,
  SignalEventReachedMessage,
  eventAggregatorSettings,
} from '@process-engine/process_engine_contracts';

import {BoundaryEventHandler} from './boundary_event_handler';

export class SignalBoundaryEventHandler extends BoundaryEventHandler {

  private subscription: Subscription;

  public async waitForTriggeringEvent(
    onTriggeredCallback: OnBoundaryEventTriggeredCallback,
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    attachedFlowNodeInstanceId: string,
  ): Promise<void> {

    this.attachedFlowNodeInstanceId = attachedFlowNodeInstanceId;

    await this.persistOnEnter(token);

    this.waitForSignal(onTriggeredCallback, token, processModelFacade);
  }

  public async resumeWait(
    boundaryEventInstance: FlowNodeInstance,
    onTriggeredCallback: OnBoundaryEventTriggeredCallback,
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    attachedFlowNodeInstanceId: string,
  ): Promise<void> {

    this.boundaryEventInstance = boundaryEventInstance;
    this.attachedFlowNodeInstanceId = attachedFlowNodeInstanceId;

    this.waitForSignal(onTriggeredCallback, token, processModelFacade);
  }

  public async cancel(token: ProcessToken, processModelFacade: IProcessModelFacade): Promise<void> {
    await super.cancel(token, processModelFacade);
    this.eventAggregator.unsubscribe(this.subscription);
  }

  private waitForSignal(
    onTriggeredCallback: OnBoundaryEventTriggeredCallback,
    token: ProcessToken,
    processModelFacade: IProcessModelFacade,
  ): void {

    const laneContainingCurrentFlowNode = processModelFacade.getLaneForFlowNode(this.boundaryEventModel.id);
    if (laneContainingCurrentFlowNode != undefined) {
      token.currentLane = laneContainingCurrentFlowNode.name;
    }

    const signalBoundaryEventName = eventAggregatorSettings.messagePaths.signalEventReached
      .replace(eventAggregatorSettings.messageParams.signalReference, this.boundaryEventModel.signalEventDefinition.name);

    const signalReceivedCallback = async (signal: SignalEventReachedMessage): Promise<void> => {

      const nextFlowNode = this.getNextFlowNode(processModelFacade);

      const eventData = {
        boundaryInstanceId: this.boundaryEventInstanceId,
        nextFlowNode: nextFlowNode,
        interruptHandler: this.boundaryEventModel.cancelActivity,
        eventPayload: signal?.currentToken ?? {},
      };

      this.sendBoundaryEventTriggeredNotification(token);

      return onTriggeredCallback(eventData);
    };

    // An interrupting BoundaryEvent can only be triggered once.
    // A non-interrupting BoundaryEvent can be triggerred repeatedly.
    this.subscription = this.boundaryEventModel.cancelActivity
      ? this.eventAggregator.subscribeOnce(signalBoundaryEventName, signalReceivedCallback)
      : this.eventAggregator.subscribe(signalBoundaryEventName, signalReceivedCallback);
  }

}
