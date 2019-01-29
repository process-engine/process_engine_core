import {IContainer} from 'addict-ioc';

import {IIdentity} from '@essential-projects/iam_contracts';
import {
  IProcessModelFacade,
  IProcessTokenFacade,
  Model,
  Runtime,
} from '@process-engine/process_engine_contracts';

import {FlowNodeHandlerInterruptible} from './index';

export class ServiceTaskHandler extends FlowNodeHandlerInterruptible<Model.Activities.ServiceTask> {

  private _childHandler: FlowNodeHandlerInterruptible<Model.Activities.ServiceTask>;

  constructor(container: IContainer, serviceTaskModel: Model.Activities.ServiceTask) {
    super(container, serviceTaskModel);
    this._childHandler = this._getChildHandler();
  }

  public getInstanceId(): string {
    return this._childHandler.getInstanceId();
  }

  public async interrupt(token: Runtime.Types.ProcessToken, terminate?: boolean): Promise<void> {
    return this._childHandler.interrupt(token, terminate);
  }

  private _getChildHandler(): FlowNodeHandlerInterruptible<Model.Activities.ServiceTask> {

    if (this.flowNode.type === Model.Activities.ServiceTaskType.external) {
      return this._container.resolve<FlowNodeHandlerInterruptible<Model.Activities.ServiceTask>>('ExternalServiceTaskHandler', [this.flowNode]);
    }

    return this._container.resolve<FlowNodeHandlerInterruptible<Model.Activities.ServiceTask>>('InternalServiceTaskHandler', [this.flowNode]);
  }

  protected async executeInternally(
    token: Runtime.Types.ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Model.Base.FlowNode> {

    await this._childHandler.execute(token, processTokenFacade, processModelFacade, identity, this.previousFlowNodeInstanceId);

    return this._getFlowNodeAfterChildHandler(processModelFacade);
  }
  protected async resumeInternally(
    flowNodeInstance: Runtime.Types.FlowNodeInstance,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Model.Base.FlowNode> {

    await this._childHandler.resume(flowNodeInstance, processTokenFacade, processModelFacade, identity);

    return this._getFlowNodeAfterChildHandler(processModelFacade);
  }

  private _getFlowNodeAfterChildHandler(processModelFacade: IProcessModelFacade): Model.Base.FlowNode {
    const decoratedHandlerFlowNode: Model.Base.FlowNode = this._childHandler.getFlowNode();

    return processModelFacade.getNextFlowNodeFor(decoratedHandlerFlowNode);
  }
}
