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

  protected attachedFlowNodeInstanceId: string;

  protected readonly boundaryEventModel: Model.Events.BoundaryEvent;
  protected readonly flowNodePersistenceFacade: IFlowNodePersistenceFacade;

  protected readonly boundaryEventInstanceId: string;

  constructor(
    flowNodePersistenceFacade: IFlowNodePersistenceFacade,
    boundaryEventModel: Model.Events.BoundaryEvent,
  ) {
    this.flowNodePersistenceFacade = flowNodePersistenceFacade;
    this.boundaryEventModel = boundaryEventModel;
    this.boundaryEventInstanceId = uuid.v4();
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

}
