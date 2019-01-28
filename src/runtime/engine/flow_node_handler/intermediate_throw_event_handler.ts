import {IContainer} from 'addict-ioc';

import {InternalServerError} from '@essential-projects/errors_ts';
import {IIdentity} from '@essential-projects/iam_contracts';
import {
  IProcessModelFacade,
  IProcessTokenFacade,
  Model,
  NextFlowNodeInfo,
  Runtime,
} from '@process-engine/process_engine_contracts';

import {FlowNodeHandler} from './index';

export class IntermediateThrowEventHandler extends FlowNodeHandler<Model.Events.IntermediateThrowEvent> {

  private _childHandler: FlowNodeHandler<Model.Events.IntermediateCatchEvent>;

  constructor(container: IContainer, intermediateThrowEventModel: Model.Events.IntermediateThrowEvent) {
    super(container, intermediateThrowEventModel);
    this._childHandler = this._getChildEventHandler();
  }

  public getInstanceId(): string {
    return this._childHandler.getInstanceId();
  }

  private _getChildEventHandler(): FlowNodeHandler<Model.Events.IntermediateCatchEvent> {

    if (this.flowNode.linkEventDefinition) {
      return this
        ._container
        .resolve<FlowNodeHandler<Model.Events.IntermediateCatchEvent>>('IntermediateLinkThrowEventHandler', [this.flowNode]);
    }

    if (this.flowNode.messageEventDefinition) {
      return this._container.resolve<FlowNodeHandler<Model.Events.IntermediateCatchEvent>>('IntermediateMessageThrowEventHandler', [this.flowNode]);
    }

    if (this.flowNode.signalEventDefinition) {
      return this._container.resolve<FlowNodeHandler<Model.Events.IntermediateCatchEvent>>('IntermediateSignalThrowEventHandler', [this.flowNode]);
    }

    throw new InternalServerError(`The IntermediateThrowEventType used with FlowNode ${this.flowNode.id} is not supported!`);
  }

  protected async executeInternally(token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    identity: IIdentity): Promise<NextFlowNodeInfo> {

    return this._childHandler.execute(token, processTokenFacade, processModelFacade, identity, this.previousFlowNodeInstanceId);
  }

  protected async resumeInternally(flowNodeInstance: Runtime.Types.FlowNodeInstance,
                                   processTokenFacade: IProcessTokenFacade,
                                   processModelFacade: IProcessModelFacade,
                                   identity: IIdentity): Promise<NextFlowNodeInfo> {

    return this._childHandler.resume(flowNodeInstance, processTokenFacade, processModelFacade, identity);
  }
}
