import { BpmnType, IFlowNodeHandler, IFlowNodeHandlerFactory, IProcessModelFascade, Model} from '@process-engine/process_engine_contracts';
import { IContainer } from 'addict-ioc';

enum BoundaryEventDefinitionType {
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

  public async create<TFlowNode extends Model.Base.FlowNode>(flowNode: TFlowNode,
                                                             processModelFascade: IProcessModelFascade): Promise<IFlowNodeHandler<TFlowNode>> {
    const flowNodeHandler: IFlowNodeHandler<TFlowNode> = await this._create<TFlowNode>(flowNode.bpmnType);

    const boundaryEvents: Array<Model.Events.BoundaryEvent> = processModelFascade.getBoundaryEventsFor(flowNode);

    if (boundaryEvents.length === 0) {
      return flowNodeHandler;
    }

    // the original FlowNodeHandler created above will now be decorated by one handler for each BoundaryEvent that is attached to the FlowNode
    // as a result, the `execute`-method will be called on the topmost decorated BoundaryEventHandler
    // the BoundaryEventHandler will then pass the `execute`-call down to the next BoundaryEventHandler until the original FlowNodeHandler is called
    return this._decorateWithBoundaryEventHandlers(boundaryEvents, processModelFascade, flowNodeHandler);
  }

  // tslint:disable-next-line:cyclomatic-complexity
  private async _create<TFlowNode extends Model.Base.FlowNode>(type: BpmnType): Promise<IFlowNodeHandler<TFlowNode>> {
    switch (type) {
      case BpmnType.startEvent:
        return this._createHandler<TFlowNode>('StartEventHandler');
      case BpmnType.callActivity:
        return this._createHandler<TFlowNode>('CallActivityHandler');
      case BpmnType.exclusiveGateway:
        return this._createHandler<TFlowNode>('ExclusiveGatewayHandler');
      case BpmnType.parallelGateway:
        return this._createHandler<TFlowNode>('ParallelGatewayHandler');
      case BpmnType.serviceTask:
        return this._createHandler<TFlowNode>('ServiceTaskHandler');
      case BpmnType.scriptTask:
        return this._createHandler<TFlowNode>('ScriptTaskHandler');
      case BpmnType.intermediateCatchEvent:
        return this._createHandler<TFlowNode>('IntermediateCatchEventHandler');
      case BpmnType.intermediateThrowEvent:
        return this._createHandler<TFlowNode>('IntermediateThrowEventHandler');
      case BpmnType.endEvent:
        return this._createHandler<TFlowNode>('EndEventHandler');
      case BpmnType.subProcess:
        return this._createHandler<TFlowNode>('SubProcessHandler');
      default:
        throw Error(`Es konnte kein FlowNodeHandler für den FlowNodeType ${type} gefunden werden.`);
    }
  }

  private async _createHandler<TFlowNode extends Model.Base.FlowNode>(registrationKey: string): Promise<IFlowNodeHandler<TFlowNode>> {
    return this.container.resolveAsync<IFlowNodeHandler<TFlowNode>>(registrationKey);
  }

  private async _decorateWithBoundaryEventHandlers<TFlowNode extends Model.Base.FlowNode>(boundaryEvents: Array<Model.Events.BoundaryEvent>,
                                                                                          processModelFascade: IProcessModelFascade,
                                                                                          handlerToDecorate: IFlowNodeHandler<Model.Base.FlowNode>)
                                                                                          : Promise<IFlowNodeHandler<TFlowNode>> {

    // first the boundary events are ordered by type
    // e.g.: the ErrorBoundaryEventHandler has to be applied before other BoundaryEvents so that it only catches errors
    // from the actual FlowNode it is attached to
    this._orderBoundaryEventsByPriority(boundaryEvents);

    let currentHandler: IFlowNodeHandler<Model.Base.FlowNode> = handlerToDecorate;

    for (const boundaryEvent of boundaryEvents) {
      currentHandler = await this._createBoundaryEventHandler(boundaryEvent, currentHandler);
    }

    return currentHandler;
  }

  private async _createBoundaryEventHandler(boundaryEventNode: Model.Events.BoundaryEvent,
                                            handlerToDecorate: IFlowNodeHandler<Model.Base.FlowNode>)
                                            : Promise<IFlowNodeHandler<Model.Base.FlowNode>> {

    // the handler that shall be decorated is passed through using the IoC container
    // this causes the handler to be injected after the declared dependencies of the individual handler that gets instantiated in this method
    const argumentsToPassThrough: Array<any> = handlerToDecorate ? [handlerToDecorate] : [];

    const eventDefinitionType: BoundaryEventDefinitionType = this._getEventDefinitionType(boundaryEventNode);

    switch (eventDefinitionType) {
      case BoundaryEventDefinitionType.Error:
        return this.container.resolveAsync<IFlowNodeHandler<Model.Base.FlowNode>>('ErrorBoundaryEventHandler', argumentsToPassThrough);
      case BoundaryEventDefinitionType.Timer:
        return this.container.resolveAsync<IFlowNodeHandler<Model.Base.FlowNode>>('TimerBoundaryEventHandler', argumentsToPassThrough);
      case BoundaryEventDefinitionType.Message:
        return this.container.resolveAsync<IFlowNodeHandler<Model.Base.FlowNode>>('MessageBoundaryEventHandler', argumentsToPassThrough);
      case BoundaryEventDefinitionType.Signal:
        return this.container.resolveAsync<IFlowNodeHandler<Model.Base.FlowNode>>('SignalBoundaryEventHandler', argumentsToPassThrough);
      default:
        throw Error(`Es konnte kein BoundaryEventHandler für den EventDefinitionType ${eventDefinitionType} gefunden werden.`);
    }
  }

  private _getEventDefinitionType(boundaryEventNode: Model.Events.BoundaryEvent): BoundaryEventDefinitionType {
    if (boundaryEventNode.errorEventDefinition) {
      return BoundaryEventDefinitionType.Error;
    } else if (boundaryEventNode.messageEventDefinition) {
      return BoundaryEventDefinitionType.Message;
    } else if (boundaryEventNode.signalEventDefinition) {
      return BoundaryEventDefinitionType.Signal;
    } else if (boundaryEventNode.timerEventDefinition) {
      return BoundaryEventDefinitionType.Timer;
    }
  }

  private _orderBoundaryEventsByPriority(boundaryEvents: Array<Model.Events.BoundaryEvent>): void {

    // order the boundary events so that e.g. the error handler only handles the error of the actual flow node,
    // not errors of other boundary events or so

    boundaryEvents.sort((eventA: Model.Events.BoundaryEvent, eventB: Model.Events.BoundaryEvent) => {

      const eventAType: number = this._getEventDefinitionType(eventA);
      const eventBType: number = this._getEventDefinitionType(eventB);

      if (eventAType < eventBType) {
        return -1;
      } else if (eventAType > eventBType) {
        return 1;
      }

      return 0;
    });
  }

}
