import * as uuid from 'node-uuid';

import {ProcessToken} from '@process-engine/flow_node_instance.contracts';
import {
  BoundaryEventTriggeredMessage,
  IBoundaryEventHandler,
  IFlowNodePersistenceFacade,
  IProcessModelFacade,
  IProcessTokenFacade,
  OnBoundaryEventTriggeredCallback,
  eventAggregatorSettings,
} from '@process-engine/process_engine_contracts';
import {Model} from '@process-engine/process_model.contracts';
import {IEventAggregator} from '@essential-projects/event_aggregator_contracts';

/**
 * The base implementation for a BoundaryEventHandler.
 */
export abstract class BoundaryEventHandler implements IBoundaryEventHandler {

  protected attachedFlowNodeInstanceId: string;

  protected readonly eventAggregator: IEventAggregator;

  protected readonly boundaryEventModel: Model.Events.BoundaryEvent;
  protected readonly flowNodePersistenceFacade: IFlowNodePersistenceFacade;

  protected readonly boundaryEventInstanceId: string;

  constructor(
    eventAggregator: IEventAggregator,
    flowNodePersistenceFacade: IFlowNodePersistenceFacade,
    boundaryEventModel: Model.Events.BoundaryEvent,
  ) {
    this.flowNodePersistenceFacade = flowNodePersistenceFacade;
    this.boundaryEventModel = boundaryEventModel;
    this.boundaryEventInstanceId = uuid.v4();
    this.eventAggregator = eventAggregator;
  }

  public getInstanceId(): string {
    return this.boundaryEventInstanceId;
  }

  public abstract async waitForTriggeringEvent(
    onTriggeredCallback: OnBoundaryEventTriggeredCallback,
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    attachedFlowNodeInstanceId: string,
  ): Promise<void>;

  public async cancel(processToken: ProcessToken, processModelFacade: IProcessModelFacade): Promise<void> {
    await this.persistOnExit(processToken);
  }

  public getNextFlowNode(processModelFacade: IProcessModelFacade): Model.Base.FlowNode {
    // By convention, BoundaryEvents must only lead to one FlowNode.
    return processModelFacade.getNextFlowNodesFor(this.boundaryEventModel).pop();
  }

  protected async persistOnEnter(processToken: ProcessToken): Promise<void> {
    await this
      .flowNodePersistenceFacade
      .persistOnEnter(this.boundaryEventModel, this.boundaryEventInstanceId, processToken, this.attachedFlowNodeInstanceId);
  }

  protected async persistOnExit(processToken: ProcessToken): Promise<void> {
    await this.flowNodePersistenceFacade.persistOnExit(this.boundaryEventModel, this.boundaryEventInstanceId, processToken);
  }

  protected async persistOnTerminate(processToken: ProcessToken): Promise<void> {
    await this.flowNodePersistenceFacade.persistOnTerminate(this.boundaryEventModel, this.boundaryEventInstanceId, processToken);
  }

  protected async persistOnError(processToken: ProcessToken, error: Error): Promise<void> {
    await this.flowNodePersistenceFacade.persistOnError(this.boundaryEventModel, this.boundaryEventInstanceId, processToken, error);
  }

  /**
   * Publishes notifications on the EventAggregator, informing that a BoundaryEvent
   * has finished execution.
   *
   * Two notifications will be send:
   * - A global notification that everybody can receive
   * - A notification specifically for this BoundaryEvent.
   *
   * @param token    Contains all infos required for the Notification message.
   */
  protected sendBoundaryEventTriggeredNotification(token: ProcessToken): void {

    const message = new BoundaryEventTriggeredMessage(
      token.correlationId,
      token.processModelId,
      token.processInstanceId,
      this.boundaryEventModel.id,
      this.boundaryEventInstanceId,
      undefined,
      token.payload,
    );

    // FlowNode-specific notification
    const BoundaryEventTriggeredEvent = this.getBoundaryEventTriggeredEventName(token.correlationId, token.processInstanceId);
    this.eventAggregator.publish(BoundaryEventTriggeredEvent, message);

    // Global notification
    this.eventAggregator.publish(eventAggregatorSettings.messagePaths.BoundaryEventTriggered, message);
  }

  protected getBoundaryEventTriggeredEventName(correlationId: string, processInstanceId: string): string {

    const BoundaryEventTriggeredEvent = eventAggregatorSettings.messagePaths.BoundaryEventTriggered
      .replace(eventAggregatorSettings.messageParams.correlationId, correlationId)
      .replace(eventAggregatorSettings.messageParams.processInstanceId, processInstanceId)
      .replace(eventAggregatorSettings.messageParams.flowNodeInstanceId, this.boundaryEventInstanceId);

    return BoundaryEventTriggeredEvent;
  }

}
