import {Logger} from 'loggerhythm';

import {IEventAggregator, Subscription} from '@essential-projects/event_aggregator_contracts';

import {FlowNodeInstance, Model, ProcessToken} from '@process-engine/persistence_api.contracts';
import {
  IFlowNodePersistenceFacade,
  IProcessModelFacade,
  IProcessTokenFacade,
  ITimerFacade,
  OnBoundaryEventTriggeredCallback,
} from '@process-engine/process_engine_contracts';

import {BoundaryEventHandler} from './boundary_event_handler';

export class TimerBoundaryEventHandler extends BoundaryEventHandler {

  private readonly logger: Logger;
  private readonly timerFacade: ITimerFacade;

  private timerSubscription: Subscription;

  constructor(
    eventAggregator: IEventAggregator,
    flowNodePersistenceFacade: IFlowNodePersistenceFacade,
    timerFacade: ITimerFacade,
    boundaryEventModel: Model.Events.BoundaryEvent,
  ) {
    super(eventAggregator, flowNodePersistenceFacade, boundaryEventModel);
    this.timerFacade = timerFacade;
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
    this.attachedFlowNodeInstanceId = attachedFlowNodeInstanceId;

    await this.persistOnEnter(token);

    this.initializeTimer(onTriggeredCallback, token, processTokenFacade, processModelFacade);
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

    this.initializeTimer(onTriggeredCallback, token, processTokenFacade, processModelFacade);
  }

  public async cancel(token: ProcessToken, processModelFacade: IProcessModelFacade): Promise<void> {
    this.timerFacade.cancelTimerSubscription(this.timerSubscription);
    await super.cancel(token, processModelFacade);
  }

  private initializeTimer(
    onTriggeredCallback: OnBoundaryEventTriggeredCallback,
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
  ): void {

    const laneContainingCurrentFlowNode = processModelFacade.getLaneForFlowNode(this.boundaryEventModel.id);
    if (laneContainingCurrentFlowNode != undefined) {
      token.currentLane = laneContainingCurrentFlowNode.name;
    }

    const timerElapsed = async (): Promise<void> => {

      this.logger.verbose(`TimerBoundaryEvent for ProcessModel ${token.processModelId} in ProcessInstance ${token.processInstanceId} was triggered.`);

      const nextFlowNode = this.getNextFlowNode(processModelFacade);

      const eventData = {
        boundaryInstanceId: this.boundaryEventInstanceId,
        nextFlowNode: nextFlowNode,
        interruptHandler: this.boundaryEventModel.cancelActivity,
        eventPayload: {},
      };

      this.sendBoundaryEventTriggeredNotification(token);

      onTriggeredCallback(eventData);
    };

    this.timerSubscription = this
      .timerFacade
      .initializeTimer(this.boundaryEventModel, this.boundaryEventModel.timerEventDefinition, processTokenFacade, timerElapsed);
  }

}
