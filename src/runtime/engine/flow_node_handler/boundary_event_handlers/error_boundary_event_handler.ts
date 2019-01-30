import {IContainer} from 'addict-ioc';

import {IIdentity} from '@essential-projects/iam_contracts';
import {
  IProcessModelFacade,
  IProcessTokenFacade,
  Model,
  Runtime,
} from '@process-engine/process_engine_contracts';

import {FlowNodeHandlerInterruptible} from '../index';
export class ErrorBoundaryEventHandler extends FlowNodeHandlerInterruptible<Model.Events.BoundaryEvent> {

  private _decoratedHandler: FlowNodeHandlerInterruptible<Model.Base.FlowNode>;

  constructor(
    container: IContainer,
    decoratedHandler: FlowNodeHandlerInterruptible<Model.Base.FlowNode>,
    errorBoundaryEventModel: Model.Events.BoundaryEvent,
  ) {
    super(container, errorBoundaryEventModel);
    this._decoratedHandler = decoratedHandler;
  }

  // Since ErrorBoundaryEvents can be part of a BoundaryEventChain, they must also implement this method,
  // so they can tell their decorated handler to abort.
  public async interrupt(token: Runtime.Types.ProcessToken, terminate?: boolean): Promise<void> {
    return this._decoratedHandler.interrupt(token, terminate);
  }

  protected async executeInternally(
    token: Runtime.Types.ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Model.Base.FlowNode> {
    try {
      await this._decoratedHandler.execute(token, processTokenFacade, processModelFacade, identity, this.previousFlowNodeInstanceId);

      const decoratedHandlerFlowNode: Model.Base.FlowNode = this._decoratedHandler.getFlowNode();

      return processModelFacade.getNextFlowNodeFor(decoratedHandlerFlowNode);
    } catch (err) {
      return processModelFacade.getNextFlowNodeFor(this.flowNode);
    }
  }

  protected async resumeInternally(
    flowNodeInstance: Runtime.Types.FlowNodeInstance,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Model.Base.FlowNode> {

    try {
      await this._decoratedHandler.resume(flowNodeInstance, processTokenFacade, processModelFacade, identity);

      const decoratedHandlerFlowNode: Model.Base.FlowNode = this._decoratedHandler.getFlowNode();

      return processModelFacade.getNextFlowNodeFor(decoratedHandlerFlowNode);
    } catch (err) {
      return processModelFacade.getNextFlowNodeFor(this.flowNode);
    }
  }
}
