import * as uuid from 'node-uuid';

import {
  FlowNodeInstance,
  FlowNodeInstanceState,
  Model,
  ProcessToken,
} from '@process-engine/persistence_api.contracts';
import {
  BoundaryEventTriggeredMessage,
  IBoundaryEventHandler,
  IFlowNodePersistenceFacade,
  IProcessModelFacade,
  IProcessTokenFacade,
  OnBoundaryEventTriggeredCallback,
  eventAggregatorSettings,
} from '@process-engine/process_engine_contracts';

import {IEventAggregator} from '@essential-projects/event_aggregator_contracts';

/**
 * The base implementation for a BoundaryEventHandler.
 */
export abstract class BoundaryEventHandler implements IBoundaryEventHandler {

  protected attachedFlowNodeInstanceId: string;

  protected readonly eventAggregator: IEventAggregator;

  protected readonly boundaryEventModel: Model.Events.BoundaryEvent;
  protected readonly flowNodePersistenceFacade: IFlowNodePersistenceFacade;

  protected boundaryEventInstanceId: string;
  private flowNodeInstance?: FlowNodeInstance; // Only set during FlowNode resumption.

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

  protected set boundaryEventInstance(flowNodeInstance: FlowNodeInstance) {
    this.flowNodeInstance = flowNodeInstance;
    this.boundaryEventInstanceId = flowNodeInstance.id;
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

  public abstract async resumeWait(
    boundaryEventInstance: FlowNodeInstance,
    onTriggeredCallback: OnBoundaryEventTriggeredCallback,
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    attachedFlowNodeInstanceId: string,
  ): Promise<void>;

  public async cancel(processToken: ProcessToken, processModelFacade: IProcessModelFacade): Promise<void> {
    if (this.boundaryEventInstance?.state === FlowNodeInstanceState.finished) {
      return;
    }
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
   * Publishes a notification on the EventAggregator, informing about a new
   * triggered Boundary Event.
   *
   * @param token    Contains all the information required for the notification message.
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

    this.eventAggregator.publish(eventAggregatorSettings.messagePaths.boundaryEventTriggered, message);
  }

}
