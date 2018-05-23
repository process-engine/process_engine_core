import { BpmnType, Model } from '@process-engine/process_engine_contracts';
import { IContainer } from 'addict-ioc';
import { IFlowNodeHandler, IFlowNodeHandlerFactory } from '.';
import {
  IProcessModelFascade,
} from './../../index';

enum BoundaryEventDefinitionType {
  Error = 0,
  Timer = 1,
  Message = 2,
  Signal = 3,
}

export class FlowNodeHandlerFactory implements IFlowNodeHandlerFactory {

  private container: IContainer;

  constructor(container: IContainer) {
    this.container = container;
  }

  public async create<TFlowNode extends Model.Base.FlowNode>(flowNode: TFlowNode,
                                                             processModelFascade: IProcessModelFascade): Promise<IFlowNodeHandler<TFlowNode>> {
    const flowNodeHandler: IFlowNodeHandler<TFlowNode> = await this._create<TFlowNode>(flowNode.bpmnType);

    const boundaryEvents: Array<Model.Events.BoundaryEvent> = processModelFascade.getBoundaryEventsFor(flowNode);

    if (boundaryEvents.length === 0) {
      return flowNodeHandler;
    }

    return this._decorateWithBoundaryEventHandlers(boundaryEvents, processModelFascade, flowNodeHandler);
  }

  private async _create<TFlowNode extends Model.Base.FlowNode>(type: BpmnType): Promise<IFlowNodeHandler<TFlowNode>> {
    switch (type) {
      case BpmnType.startEvent:
        return this.container.resolveAsync<IFlowNodeHandler<TFlowNode>>('StartEventHandler');
      case BpmnType.exclusiveGateway:
        return this.container.resolveAsync<IFlowNodeHandler<TFlowNode>>('ExclusiveGatewayHandler');
      case BpmnType.parallelGateway:
        return this.container.resolveAsync<IFlowNodeHandler<TFlowNode>>('ParallelGatewayHandler');
      case BpmnType.serviceTask:
        return this.container.resolveAsync<IFlowNodeHandler<TFlowNode>>('ServiceTaskHandler');
      case BpmnType.scriptTask:
        const flowNodeHandler: IFlowNodeHandler<Model.Activities.ScriptTask> =
          await this.container.resolveAsync<IFlowNodeHandler<Model.Activities.ScriptTask>>('ScriptTaskHandler');

        return this.container.resolveAsync<IFlowNodeHandler<TFlowNode>>('ErrorBoundaryEventHandler', [flowNodeHandler]);
      case BpmnType.intermediateCatchEvent:
        return this.container.resolveAsync<IFlowNodeHandler<TFlowNode>>('IntermediateCatchEventHandler');
      case BpmnType.intermediateThrowEvent:
        return this.container.resolveAsync<IFlowNodeHandler<TFlowNode>>('IntermediateThrowEventHandler');
      case BpmnType.endEvent:
        return this.container.resolveAsync<IFlowNodeHandler<TFlowNode>>('EndEventHandler');
      default:
        throw Error(`Es konnte kein FlowNodeHandler für den FlowNodeType ${type} gefunden werden.`);
    }
  }

  private async _decorateWithBoundaryEventHandlers<TFlowNode extends Model.Base.FlowNode>(boundaryEvents: Array<Model.Events.BoundaryEvent>,
                                                                                          processModelFascade: IProcessModelFascade,
                                                                                          handlerToDecorate: IFlowNodeHandler<Model.Base.FlowNode>)
                                                                                          : Promise<IFlowNodeHandler<TFlowNode>> {

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
