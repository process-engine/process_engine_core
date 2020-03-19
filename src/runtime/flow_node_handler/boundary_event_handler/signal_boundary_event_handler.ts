import {Logger} from 'loggerhythm';

import {IEventAggregator, Subscription} from '@essential-projects/event_aggregator_contracts';

import {FlowNodeInstance, Model, ProcessToken} from '@process-engine/persistence_api.contracts';
import {
  IFlowNodePersistenceFacade,
  IProcessModelFacade,
  IProcessTokenFacade,
  OnBoundaryEventTriggeredCallback,
  SignalEventReachedMessage,
  eventAggregatorSettings,
} from '@process-engine/process_engine_contracts';

import {BoundaryEventHandler} from './boundary_event_handler';

export class SignalBoundaryEventHandler extends BoundaryEventHandler {

  private readonly logger: Logger;

  private subscription: Subscription;

  constructor(
    eventAggregator: IEventAggregator,
    flowNodePersistenceFacade: IFlowNodePersistenceFacade,
    boundaryEventModel: Model.Events.BoundaryEvent,
  ) {
    super(eventAggregator, flowNodePersistenceFacade, boundaryEventModel);
    this.logger = new Logger(`processengine:timer_boundary_event_handler:${boundaryEventModel.id}`);
  }

  public async waitForTriggeringEvent(
    onTriggeredCallback: OnBoundaryEventTriggeredCallback,
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    attachedFlowNodeInstanceId: string,
  ): Promise<void> {

    this.logger.verbose(`Initializing BoundaryEvent on FlowNodeInstance ${attachedFlowNodeInstanceId} in ProcessInstance ${token.processInstanceId}`);
    await this.persistOnEnter(token, attachedFlowNodeInstanceId);

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

    this.logger.verbose(`Resuming BoundaryEvent on FlowNodeInstance ${attachedFlowNodeInstanceId} in ProcessInstance ${token.processInstanceId}`);

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
