import {
  BpmnType,
  IFlowNodeHandler,
  IFlowNodeHandlerFactory,
  IProcessModelFacade,
  Model,
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

  constructor(container: IContainer) {
    this._container = container;
  }

  private get container(): IContainer {
    return this._container;
  }

  public async create<TFlowNode extends Model.Base.FlowNode>(
    flowNode: TFlowNode,
    processModelFacade: IProcessModelFacade,
  ): Promise<IFlowNodeHandler<TFlowNode>> {

    const flowNodeHandler: IFlowNodeHandler<TFlowNode> = await this._create<TFlowNode>(flowNode);

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
  private async _create<TFlowNode extends Model.Base.FlowNode>(flowNode: TFlowNode): Promise<IFlowNodeHandler<TFlowNode>> {
    switch (flowNode.bpmnType) {
      case BpmnType.startEvent:
        return this._createHandler<TFlowNode>('StartEventHandler', flowNode);
      case BpmnType.callActivity:
        return this._createHandler<TFlowNode>('CallActivityHandler', flowNode);
      case BpmnType.exclusiveGateway:
        return this._createHandler<TFlowNode>('ExclusiveGatewayHandler', flowNode);
      case BpmnType.parallelGateway:
        return this._createHandler<TFlowNode>('ParallelGatewayHandler', flowNode);
      case BpmnType.serviceTask:
        return this._createHandler<TFlowNode>('ServiceTaskHandler', flowNode);
      case BpmnType.scriptTask:
        return this._createHandler<TFlowNode>('ScriptTaskHandler', flowNode);
      case BpmnType.intermediateCatchEvent:
        return this._createHandler<TFlowNode>('IntermediateCatchEventHandler', flowNode);
      case BpmnType.intermediateThrowEvent:
        return this._createHandler<TFlowNode>('IntermediateThrowEventHandler', flowNode);
      case BpmnType.endEvent:
        return this._createHandler<TFlowNode>('EndEventHandler', flowNode);
      case BpmnType.subProcess:
        return this._createHandler<TFlowNode>('SubProcessHandler', flowNode);
      case BpmnType.userTask:
        return this._createHandler<TFlowNode>('UserTaskHandler', flowNode);
      case BpmnType.sendTask:
        return this._createHandler<TFlowNode>('SendTaskHandler', flowNode);
      case BpmnType.receiveTask:
        return this._createHandler<TFlowNode>('ReceiveTaskHandler', flowNode);
      case BpmnType.manualTask:
        return this._createHandler<TFlowNode>('ManualTaskHandler', flowNode);
      default:
        throw Error(`No FlowNodeHandler for BPMN type "${flowNode.bpmnType}" found.`);
    }
  }

  private async _createHandler<TFlowNode extends Model.Base.FlowNode>(
    registrationKey: string,
    flowNode: TFlowNode,
  ): Promise<IFlowNodeHandler<TFlowNode>> {
    return this.container.resolveAsync<IFlowNodeHandler<TFlowNode>>(registrationKey, [flowNode]);
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

    const eventDefinitionType: BoundaryEventType = this._getEventDefinitionType(boundaryEventNode);

    switch (eventDefinitionType) {
      case BoundaryEventType.Error:
        return this.container.resolveAsync<IFlowNodeHandler<TFlowNode>>('ErrorBoundaryEventHandler', argumentsToPassThrough);
      case BoundaryEventType.Message:
        return this.container.resolveAsync<IFlowNodeHandler<TFlowNode>>('MessageBoundaryEventHandler', argumentsToPassThrough);
      case BoundaryEventType.Signal:
        return this.container.resolveAsync<IFlowNodeHandler<TFlowNode>>('SignalBoundaryEventHandler', argumentsToPassThrough);
      case BoundaryEventType.Timer:
        return this.container.resolveAsync<IFlowNodeHandler<TFlowNode>>('TimerBoundaryEventHandler', argumentsToPassThrough);
      default:
        throw Error(`No BoundaryEventHandler for EventDefinitionType ${eventDefinitionType} found.`);
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
