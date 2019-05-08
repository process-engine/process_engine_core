import {Logger} from 'loggerhythm';

import {Subscription} from '@essential-projects/event_aggregator_contracts';

import {ProcessToken} from '@process-engine/flow_node_instance.contracts';
import {
  IFlowNodePersistenceFacade,
  IProcessModelFacade,
  IProcessTokenFacade,
  ITimerFacade,
  OnBoundaryEventTriggeredCallback,
} from '@process-engine/process_engine_contracts';
import {Model} from '@process-engine/process_model.contracts';

import {BoundaryEventHandler} from './boundary_event_handler';

export class TimerBoundaryEventHandler extends BoundaryEventHandler {

  private readonly logger: Logger;
  private readonly timerFacade: ITimerFacade;

  private timerSubscription: Subscription;

  constructor(
    flowNodePersistenceFacade: IFlowNodePersistenceFacade,
    timerFacade: ITimerFacade,
    boundaryEventModel: Model.Events.BoundaryEvent,
  ) {
    super(flowNodePersistenceFacade, boundaryEventModel);
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

    this.logger.verbose(`Initializing TimerBoundaryEvent for ProcessModel ${token.processModelId} in ProcessInstance ${token.processInstanceId}`);
    this.attachedFlowNodeInstanceId = attachedFlowNodeInstanceId;

    await this.persistOnEnter(token);

    const timerElapsed = async (): Promise<void> => {

      this.logger.verbose(`TimerBoundaryEvent for ProcessModel ${token.processModelId} in ProcessInstance ${token.processInstanceId} was triggered.`);

      const nextFlowNode = this.getNextFlowNode(processModelFacade);

      const eventData = {
        boundaryInstanceId: this.boundaryEventInstanceId,
        nextFlowNode: nextFlowNode,
        interruptHandler: this.boundaryEventModel.cancelActivity,
        eventPayload: {},
      };

      onTriggeredCallback(eventData);
    };

    this.timerSubscription = this
      .timerFacade
      .initializeTimerFromDefinition(this.boundaryEventModel, this.boundaryEventModel.timerEventDefinition, processTokenFacade, timerElapsed);
  }

  public async cancel(token: ProcessToken, processModelFacade: IProcessModelFacade): Promise<void> {
    await super.cancel(token, processModelFacade);
    this.timerFacade.cancelTimerSubscription(this.timerSubscription);
  }

}
