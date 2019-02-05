import {InternalServerError} from '@essential-projects/errors_ts';
import {
  BpmnType,
  IFlowNodeHandler,
  IFlowNodeHandlerFactory,
  Model,
  Runtime,
} from '@process-engine/process_engine_contracts';

import {IContainer} from 'addict-ioc';

export class FlowNodeHandlerFactory implements IFlowNodeHandlerFactory {

  private _container: IContainer;
  private _intermediateCatchEventHandlerFactory: IFlowNodeHandlerFactory;
  private _intermediateThrowEventHandlerFactory: IFlowNodeHandlerFactory;
  private _parallelGatewayHandlerFactory: IFlowNodeHandlerFactory;
  private _serviceTaskHandlerFactory: IFlowNodeHandlerFactory;

  constructor(
    container: IContainer,
    intermediateCatchEventHandlerFactory: IFlowNodeHandlerFactory,
    intermediateThrowEventHandlerFactory: IFlowNodeHandlerFactory,
    parallelGatewayHandlerFactory: IFlowNodeHandlerFactory,
    serviceTaskHandlerFactory: IFlowNodeHandlerFactory,
  ) {
    this._container = container;
    this._intermediateCatchEventHandlerFactory = intermediateCatchEventHandlerFactory;
    this._intermediateThrowEventHandlerFactory = intermediateThrowEventHandlerFactory;
    this._parallelGatewayHandlerFactory = parallelGatewayHandlerFactory;
    this._serviceTaskHandlerFactory = serviceTaskHandlerFactory;
  }

  public async create<TFlowNode extends Model.Base.FlowNode>(
    flowNode: TFlowNode,
    processToken: Runtime.Types.ProcessToken,
  ): Promise<IFlowNodeHandler<TFlowNode>> {

  // tslint:disable-next-line:cyclomatic-complexity
    switch (flowNode.bpmnType) {
      case BpmnType.intermediateCatchEvent:
        return this._intermediateCatchEventHandlerFactory.create(flowNode, processToken);

      case BpmnType.intermediateThrowEvent:
        return this._intermediateThrowEventHandlerFactory.create(flowNode, processToken);

      case BpmnType.parallelGateway:
        return this._parallelGatewayHandlerFactory.create(flowNode, processToken);

      case BpmnType.serviceTask:
        return this._serviceTaskHandlerFactory.create(flowNode, processToken);

      case BpmnType.startEvent:
        return this._resolveHandlerInstance<TFlowNode>('StartEventHandler', flowNode);

      case BpmnType.callActivity:
        return this._resolveHandlerInstance<TFlowNode>('CallActivityHandler', flowNode);

      case BpmnType.exclusiveGateway:
        return this._resolveHandlerInstance<TFlowNode>('ExclusiveGatewayHandler', flowNode);

      case BpmnType.scriptTask:
        return this._resolveHandlerInstance<TFlowNode>('ScriptTaskHandler', flowNode);

      case BpmnType.endEvent:
        return this._resolveHandlerInstance<TFlowNode>('EndEventHandler', flowNode);

      case BpmnType.subProcess:
        return this._resolveHandlerInstance<TFlowNode>('SubProcessHandler', flowNode);

      case BpmnType.userTask:
        return this._resolveHandlerInstance<TFlowNode>('UserTaskHandler', flowNode);

      case BpmnType.sendTask:
        return this._resolveHandlerInstance<TFlowNode>('SendTaskHandler', flowNode);

      case BpmnType.receiveTask:
        return this._resolveHandlerInstance<TFlowNode>('ReceiveTaskHandler', flowNode);

      case BpmnType.manualTask:
        return this._resolveHandlerInstance<TFlowNode>('ManualTaskHandler', flowNode);

      default:
        throw Error(`BPMN type "${flowNode.bpmnType}" is not supported!`);
    }
  }

  private async _resolveHandlerInstance<TFlowNode extends Model.Base.FlowNode>(
    handlerRegistrationKey: string,
    flowNode: TFlowNode,
  ): Promise<IFlowNodeHandler<TFlowNode>> {

    const handlerIsNotRegistered: boolean = !this._container.isRegistered(handlerRegistrationKey);
    if (handlerIsNotRegistered) {
      throw new InternalServerError(`No FlowNodeHandler for BPMN type "${flowNode.bpmnType}" is registered at the ioc container!`);
    }

    return this._container.resolveAsync<IFlowNodeHandler<TFlowNode>>(handlerRegistrationKey, [flowNode]);
  }
}
