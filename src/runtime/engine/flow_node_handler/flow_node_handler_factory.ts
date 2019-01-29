import {InternalServerError} from '@essential-projects/errors_ts';
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

/**
 * Maps all supported BPMN Types to the name of the matching handler as it is registered in the ioc container.
 */
const bpmnTypeToRegistrationMap: {[bpmnType: string]: string} = {
  'bpmn:StartEvent': 'StartEventHandler',
  'bpmn:CallActivity': 'CallActivityHandler',
  'bpmn:ExclusiveGateway': 'ExclusiveGatewayHandler',
  'bpmn:ScriptTask': 'ScriptTaskHandler',
  'bpmn:EndEvent': 'EndEventHandler',
  'bpmn:SubProcess': 'SubProcessHandler',
  'bpmn:UserTask': 'UserTaskHandler',
  'bpmn:SendTask': 'SendTaskHandler',
  'bpmn:ReceiveTask': 'ReceiveTaskHandler',
  'bpmn:ManualTask': 'ManualTaskHandler',
};

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
  ): Promise<IFlowNodeHandler<TFlowNode>> {

    const flowNodeHandler: IFlowNodeHandler<TFlowNode> = await this._createHandler<TFlowNode>(flowNode);

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

  private async _createHandler<TFlowNode extends Model.Base.FlowNode>(flowNode: TFlowNode): Promise<IFlowNodeHandler<TFlowNode>> {
    switch (flowNode.bpmnType) {

      case BpmnType.parallelGateway:
        return this._parallelGatewayHandlerFactory.create(flowNode);

      case BpmnType.serviceTask:
        return this._serviceTaskHandlerFactory.create(flowNode);

      case BpmnType.intermediateCatchEvent:
        return this._intermediateCatchEventHandlerFactory.create(flowNode);

      case BpmnType.intermediateThrowEvent:
        return this._intermediateThrowEventHandlerFactory.create(flowNode);

      default:
        const handlerRegistrationKey: string = bpmnTypeToRegistrationMap[flowNode.bpmnType];

        return this._resolveHandlerInstance(handlerRegistrationKey, flowNode);
    }
  }

  private async _resolveHandlerInstance<TFlowNode extends Model.Base.FlowNode>(
    handlerRegistrationKey: string,
    flowNode: TFlowNode,
  ): Promise<IFlowNodeHandler<TFlowNode>> {

    const handlerIsNotRegistered: boolean = this._container.isRegistered(handlerRegistrationKey);
    if (handlerIsNotRegistered) {
      throw new InternalServerError(`No FlowNodeHandler for BPMN type "${flowNode.bpmnType}" found.`);
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

    const eventDefinitionType: BoundaryEventType = this._getEventDefinitionType(boundaryEventNode);

    switch (eventDefinitionType) {
      case BoundaryEventType.Error:
        return this._container.resolveAsync<IFlowNodeHandler<TFlowNode>>('ErrorBoundaryEventHandler', argumentsToPassThrough);
      case BoundaryEventType.Message:
        return this._container.resolveAsync<IFlowNodeHandler<TFlowNode>>('MessageBoundaryEventHandler', argumentsToPassThrough);
      case BoundaryEventType.Signal:
        return this._container.resolveAsync<IFlowNodeHandler<TFlowNode>>('SignalBoundaryEventHandler', argumentsToPassThrough);
      case BoundaryEventType.Timer:
        return this._container.resolveAsync<IFlowNodeHandler<TFlowNode>>('TimerBoundaryEventHandler', argumentsToPassThrough);
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
