import {IContainer} from 'addict-ioc';

import {InternalServerError} from '@essential-projects/errors_ts';

import {ProcessToken} from '@process-engine/flow_node_instance.contracts';
import {
  IBoundaryEventHandler,
  IBoundaryEventHandlerFactory,
  IFlowNodeHandler,
  IFlowNodeHandlerFactory,
} from '@process-engine/process_engine_contracts';
import {BpmnType, Model} from '@process-engine/process_model.contracts';

export class FlowNodeHandlerFactory implements IFlowNodeHandlerFactory {

  private container: IContainer;
  private boundaryEventHandlerFactory: IBoundaryEventHandlerFactory;
  private intermediateCatchEventHandlerFactory: IFlowNodeHandlerFactory;
  private intermediateThrowEventHandlerFactory: IFlowNodeHandlerFactory;
  private parallelGatewayHandlerFactory: IFlowNodeHandlerFactory;
  private serviceTaskHandlerFactory: IFlowNodeHandlerFactory;

  constructor(
    container: IContainer,
    boundaryEventHandlerFactory: IBoundaryEventHandlerFactory,
    intermediateCatchEventHandlerFactory: IFlowNodeHandlerFactory,
    intermediateThrowEventHandlerFactory: IFlowNodeHandlerFactory,
    parallelGatewayHandlerFactory: IFlowNodeHandlerFactory,
    serviceTaskHandlerFactory: IFlowNodeHandlerFactory,
  ) {
    this.container = container;
    this.boundaryEventHandlerFactory = boundaryEventHandlerFactory;
    this.intermediateCatchEventHandlerFactory = intermediateCatchEventHandlerFactory;
    this.intermediateThrowEventHandlerFactory = intermediateThrowEventHandlerFactory;
    this.parallelGatewayHandlerFactory = parallelGatewayHandlerFactory;
    this.serviceTaskHandlerFactory = serviceTaskHandlerFactory;
  }

  public async create<TFlowNode extends Model.Base.FlowNode>(
    flowNode: TFlowNode,
    processToken: ProcessToken,
  ): Promise<IFlowNodeHandler<TFlowNode>> {

    // tslint:disable-next-line:cyclomatic-complexity
    switch (flowNode.bpmnType) {

      case BpmnType.intermediateCatchEvent:
        return this.intermediateCatchEventHandlerFactory.create(flowNode, processToken);
      case BpmnType.intermediateThrowEvent:
        return this.intermediateThrowEventHandlerFactory.create(flowNode, processToken);
      case BpmnType.parallelGateway:
        return this.parallelGatewayHandlerFactory.create(flowNode, processToken);
      case BpmnType.serviceTask:
        return this.serviceTaskHandlerFactory.create(flowNode, processToken);
      case BpmnType.startEvent:
        return this.resolveHandlerInstance<TFlowNode>('StartEventHandler', flowNode);
      case BpmnType.callActivity:
        return this.resolveHandlerInstance<TFlowNode>('CallActivityHandler', flowNode);
      case BpmnType.emptyActivity:
        return this.resolveHandlerInstance<TFlowNode>('EmptyActivityHandler', flowNode);
      case BpmnType.exclusiveGateway:
        return this.resolveHandlerInstance<TFlowNode>('ExclusiveGatewayHandler', flowNode);
      case BpmnType.scriptTask:
        return this.resolveHandlerInstance<TFlowNode>('ScriptTaskHandler', flowNode);
      case BpmnType.endEvent:
        return this.resolveHandlerInstance<TFlowNode>('EndEventHandler', flowNode);
      case BpmnType.subProcess:
        return this.resolveHandlerInstance<TFlowNode>('SubProcessHandler', flowNode);
      case BpmnType.userTask:
        return this.resolveHandlerInstance<TFlowNode>('UserTaskHandler', flowNode);
      case BpmnType.sendTask:
        return this.resolveHandlerInstance<TFlowNode>('SendTaskHandler', flowNode);
      case BpmnType.receiveTask:
        return this.resolveHandlerInstance<TFlowNode>('ReceiveTaskHandler', flowNode);
      case BpmnType.manualTask:
        return this.resolveHandlerInstance<TFlowNode>('ManualTaskHandler', flowNode);
      case BpmnType.boundaryEvent:
        throw new InternalServerError('Must use "createForBoundaryEvent" to create BoundaryEventHandler instances!');
      default:
        throw new InternalServerError(`BPMN type "${flowNode.bpmnType}" is not supported!`);
    }
  }

  public async createForBoundaryEvent(flowNode: Model.Events.BoundaryEvent): Promise<IBoundaryEventHandler> {
    return this.boundaryEventHandlerFactory.create(flowNode);
  }

  private async resolveHandlerInstance<TFlowNode extends Model.Base.FlowNode>(
    handlerRegistrationKey: string,
    flowNode: TFlowNode,
  ): Promise<IFlowNodeHandler<TFlowNode>> {

    const handlerIsNotRegistered = !this.container.isRegistered(handlerRegistrationKey);
    if (handlerIsNotRegistered) {
      throw new InternalServerError(`No FlowNodeHandler for BPMN type "${flowNode.bpmnType}" is registered at the ioc container!`);
    }

    return this.container.resolveAsync<IFlowNodeHandler<TFlowNode>>(handlerRegistrationKey, [flowNode]);
  }

}
