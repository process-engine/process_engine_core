import {InternalServerError} from '@essential-projects/errors_ts';
import {
  BpmnType,
  IFlowNodeHandler,
  IFlowNodeHandlerFactory,
  IProcessModelFacade,
  Model,
  Runtime,
} from '@process-engine/process_engine_contracts';

import {IContainer} from 'addict-ioc';

enum BoundaryEventType {
  Error = 0,
  Timer = 1,
  Message = 2,
  Signal = 3,
}

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
    processModelFacade: IProcessModelFacade,
    processToken: Runtime.Types.ProcessToken,
  ): Promise<IFlowNodeHandler<TFlowNode>> {

    const flowNodeHandler: IFlowNodeHandler<TFlowNode> = await this._createHandler<TFlowNode>(flowNode, processModelFacade, processToken);

    const boundaryEvents: Array<Model.Events.BoundaryEvent> = processModelFacade.getBoundaryEventsFor(flowNode);

    if (boundaryEvents.length === 0) {
      return flowNodeHandler;
    }

    // The original FlowNodeHandler created above will now be decorated with handlers for each BoundaryEvent attached to the FlowNode.
    // As a result, the `execute`-method will be called on the topmost decorated BoundaryEventHandler.
    // The BoundaryEventHandler will then pass the `execute`-call down to the next BoundaryEventHandler,
    // until the original FlowNodeHandler is reached.
    return this._decorateWithBoundaryEventHandlers<TFlowNode>(boundaryEvents, flowNodeHandler);
  }

  // tslint:disable-next-line:cyclomatic-complexity
  private async _createHandler<TFlowNode extends Model.Base.FlowNode>(
    flowNode: TFlowNode,
    processModelFacade: IProcessModelFacade,
    processToken: Runtime.Types.ProcessToken,
  ): Promise<IFlowNodeHandler<TFlowNode>> {
    switch (flowNode.bpmnType) {
      case BpmnType.intermediateCatchEvent:
        return this._intermediateCatchEventHandlerFactory.create(flowNode, processModelFacade, processToken);

      case BpmnType.intermediateThrowEvent:
        return this._intermediateThrowEventHandlerFactory.create(flowNode, processModelFacade, processToken);

      case BpmnType.parallelGateway:
        return this._parallelGatewayHandlerFactory.create(flowNode, processModelFacade, processToken);

      case BpmnType.serviceTask:
        return this._serviceTaskHandlerFactory.create(flowNode, processModelFacade, processToken);

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
        throw Error(`No FlowNodeHandler for BPMN type "${flowNode.bpmnType}" found.`);
    }
  }

  private async _resolveHandlerInstance<TFlowNode extends Model.Base.FlowNode>(
    handlerRegistrationKey: string,
    flowNode: TFlowNode,
  ): Promise<IFlowNodeHandler<TFlowNode>> {

    const handlerIsNotRegistered: boolean = !this._container.isRegistered(handlerRegistrationKey);
    if (handlerIsNotRegistered) {
      throw new InternalServerError(`No FlowNodeHandler for BPMN type "${flowNode.bpmnType}" is registered at the ioc container.`);
    }

    return this._container.resolveAsync<IFlowNodeHandler<TFlowNode>>(handlerRegistrationKey, [flowNode]);
  }

  private async _decorateWithBoundaryEventHandlers<TFlowNode extends Model.Base.FlowNode>(
    boundaryEvents: Array<Model.Events.BoundaryEvent>,
    handlerToDecorate: IFlowNodeHandler<TFlowNode>,
  ): Promise<IFlowNodeHandler<TFlowNode>> {

    // First the boundary events are ordered by type and priority.
    // e.g.: the ErrorBoundaryEventHandler has to be applied before other BoundaryEvents
    // so that it only catches errors from the actual FlowNode it is attached to.
    this._orderBoundaryEventsByPriority(boundaryEvents);

    let currentHandler: IFlowNodeHandler<TFlowNode> = handlerToDecorate;

    for (const boundaryEvent of boundaryEvents) {
      currentHandler = await this._createBoundaryEventHandler<TFlowNode>(boundaryEvent, currentHandler);
    }

    return currentHandler;
  }

  private _orderBoundaryEventsByPriority(boundaryEvents: Array<Model.Events.BoundaryEvent>): void {

    boundaryEvents.sort((eventA: Model.Events.BoundaryEvent, eventB: Model.Events.BoundaryEvent) => {

      const eventAType: number = this._getEventDefinitionType(eventA);
      const eventBType: number = this._getEventDefinitionType(eventB);

      if (eventAType < eventBType) {
        return -1;
      }

      if (eventAType > eventBType) {
        return 1;
      }

      return 0;
    });
  }

  private async _createBoundaryEventHandler<TFlowNode extends Model.Base.FlowNode>(
    boundaryEventNode: Model.Events.BoundaryEvent,
    handlerToDecorate: IFlowNodeHandler<Model.Base.FlowNode>,
  ): Promise<IFlowNodeHandler<TFlowNode>> {

    // The handler to decorate is passed through to the BoundaryEventHandler via ioc as an InjectionArgument.
    // This causes the decorated handler to be injected last, after all other dependencies.
    const argumentsToPassThrough: Array<any> = [handlerToDecorate, boundaryEventNode];

    const boundaryEventType: BoundaryEventType = this._getEventDefinitionType(boundaryEventNode);

    switch (boundaryEventType) {
      case BoundaryEventType.Error:
        return this._container.resolveAsync<IFlowNodeHandler<TFlowNode>>('ErrorBoundaryEventHandler', argumentsToPassThrough);
      case BoundaryEventType.Message:
        return this._container.resolveAsync<IFlowNodeHandler<TFlowNode>>('MessageBoundaryEventHandler', argumentsToPassThrough);
      case BoundaryEventType.Signal:
        return this._container.resolveAsync<IFlowNodeHandler<TFlowNode>>('SignalBoundaryEventHandler', argumentsToPassThrough);
      case BoundaryEventType.Timer:
        return this._container.resolveAsync<IFlowNodeHandler<TFlowNode>>('TimerBoundaryEventHandler', argumentsToPassThrough);
      default:
        throw Error(`No BoundaryEventHandler for EventDefinitionType ${boundaryEventType} found.`);
    }
  }

  private _getEventDefinitionType(boundaryEventNode: Model.Events.BoundaryEvent): BoundaryEventType {
    if (boundaryEventNode.errorEventDefinition) {
      return BoundaryEventType.Error;
    }

    if (boundaryEventNode.messageEventDefinition) {
      return BoundaryEventType.Message;
    }

    if (boundaryEventNode.signalEventDefinition) {
      return BoundaryEventType.Signal;
    }

    if (boundaryEventNode.timerEventDefinition) {
      return BoundaryEventType.Timer;
    }

    return undefined;
  }
}
