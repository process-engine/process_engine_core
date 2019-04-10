import * as uuid from 'node-uuid';

import {ProcessToken} from '@process-engine/flow_node_instance.contracts';
import {
  IBoundaryEventHandler,
  IFlowNodePersistenceFacade,
  IProcessModelFacade,
  IProcessTokenFacade,
  OnBoundaryEventTriggeredCallback,
} from '@process-engine/process_engine_contracts';
import {Model} from '@process-engine/process_model.contracts';

/**
 * The base implementation for a BoundaryEventHandler.
 */
export abstract class BoundaryEventHandler implements IBoundaryEventHandler {

  private readonly _boundaryEventModel: Model.Events.BoundaryEvent;
  private readonly _flowNodePersistenceFacade: IFlowNodePersistenceFacade;

  private readonly _boundaryEventInstanceId: string;

  protected _attachedFlowNodeInstanceId: string;

  constructor(
    flowNodePersistenceFacade: IFlowNodePersistenceFacade,
    boundaryEventModel: Model.Events.BoundaryEvent,
  ) {
    this._flowNodePersistenceFacade = flowNodePersistenceFacade;
    this._boundaryEventModel = boundaryEventModel;
    this._boundaryEventInstanceId = uuid.v4();
  }

  protected get attachedFlowNodeInstanceId(): string {
    return this._attachedFlowNodeInstanceId;
  }

  protected get boundaryEvent(): Model.Events.BoundaryEvent {
    return this._boundaryEventModel;
  }

  protected get flowNodeInstanceId(): string {
    return this._boundaryEventInstanceId;
  }

  public getInstanceId(): string {
    return this._boundaryEventInstanceId;
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
    return processModelFacade.getNextFlowNodesFor(this._boundaryEventModel).pop();
  }

  protected async persistOnEnter(processToken: ProcessToken): Promise<void> {
    await this._flowNodePersistenceFacade.persistOnEnter(this.boundaryEvent, this.flowNodeInstanceId, processToken, this.attachedFlowNodeInstanceId);
  }

  protected async persistOnExit(processToken: ProcessToken): Promise<void> {
    await this._flowNodePersistenceFacade.persistOnExit(this.boundaryEvent, this.flowNodeInstanceId, processToken);
  }

  protected async persistOnTerminate(processToken: ProcessToken): Promise<void> {
    await this._flowNodePersistenceFacade.persistOnTerminate(this.boundaryEvent, this.flowNodeInstanceId, processToken);
  }

  protected async persistOnError(processToken: ProcessToken, error: Error): Promise<void> {
    await this._flowNodePersistenceFacade.persistOnError(this.boundaryEvent, this.flowNodeInstanceId, processToken, error);
  }
}
