import * as uuid from 'uuid';

import {IIdentity} from '@essential-projects/iam_contracts';
import {
  IBoundaryEventHandler,
  IProcessModelFacade,
  IProcessTokenFacade,
  Model,
  OnBoundaryEventTriggeredCallback,
  Runtime,
} from '@process-engine/process_engine_contracts';

/**
 * The base implementation for a BoundaryEventHandler.
 */
export abstract class BoundaryEventHandler implements IBoundaryEventHandler {

  protected readonly _boundaryEventModel: Model.Events.BoundaryEvent;
  protected readonly _processModelFacade: IProcessModelFacade;
  protected readonly _boundaryEventInstanceId: string;

  constructor(processModelFacade: IProcessModelFacade, boundaryEventModel: Model.Events.BoundaryEvent) {
    this._processModelFacade = processModelFacade;
    this._boundaryEventModel = boundaryEventModel;
    this._boundaryEventInstanceId = uuid.v4();
  }

  protected get boundaryEventModel(): Model.Events.BoundaryEvent {
    return this._boundaryEventModel;
  }

  protected get processModelFacade(): IProcessModelFacade {
    return this._processModelFacade;
  }

  public getInstanceId(): string {
    return this._boundaryEventInstanceId;
  }

  public abstract async waitForTriggeringEvent(
    token: Runtime.Types.ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    identity: IIdentity,
    onTriggeredCallback: OnBoundaryEventTriggeredCallback,
  ): Promise<void>;

  public async cancel(): Promise<void> {
    return Promise.resolve();
  }

  public getNextFlowNode(): Model.Base.FlowNode {
    // By convention, BoundaryEvents must only lead to one FlowNode.
    return this._processModelFacade.getNextFlowNodesFor(this._boundaryEventModel).pop();
  }
}
