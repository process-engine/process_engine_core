import {IContainer} from 'addict-ioc';

import {IIdentity} from '@essential-projects/iam_contracts';
import {
  IProcessModelFacade,
  IProcessTokenFacade,
  Model,
  NextFlowNodeInfo,
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

  protected async executeInternally(token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    identity: IIdentity): Promise<NextFlowNodeInfo> {
    try {
      // Must use return await here to prevent unhandled rejections.
      return await this._decoratedHandler.execute(token, processTokenFacade, processModelFacade, identity, this.previousFlowNodeInstanceId);
    } catch (err) {
      return this.getNextFlowNodeInfo(token, processTokenFacade, processModelFacade);
    }
  }

  protected async resumeInternally(flowNodeInstance: Runtime.Types.FlowNodeInstance,
                                   processTokenFacade: IProcessTokenFacade,
                                   processModelFacade: IProcessModelFacade,
                                   identity: IIdentity,
                                  ): Promise<NextFlowNodeInfo> {

    try {
      // Must use return await here to prevent unhandled rejections.
      return await this._decoratedHandler.resume(flowNodeInstance, processTokenFacade, processModelFacade, identity);
    } catch (err) {
      const onEnterToken: Runtime.Types.ProcessToken = flowNodeInstance.getTokenByType(Runtime.Types.ProcessTokenType.onEnter);

      return this.getNextFlowNodeInfo(onEnterToken, processTokenFacade, processModelFacade);
    }
  }
}
