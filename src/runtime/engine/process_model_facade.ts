import {NotFoundError} from '@essential-projects/errors_ts';
import {BpmnType, IProcessModelFacade, Model} from '@process-engine/process_engine_contracts';

import {SubProcessModelFacade} from './index';

export class ProcessModelFacade implements IProcessModelFacade {

  private _processModel: Model.Types.Process;

  constructor(processModel: Model.Types.Process) {
    this._processModel = processModel;
  }

  protected get processModel(): Model.Types.Process {
    return this._processModel;
  }

  public getIsExecutable(): boolean {
    return this.processModel.isExecutable;
  }

  public getSubProcessModelFacade(subProcessNode: Model.Activities.SubProcess): IProcessModelFacade {
    return new SubProcessModelFacade(this.processModel, subProcessNode);
  }

  public getStartEvents(): Array<Model.Events.StartEvent> {
    return this._filterFlowNodesByType<Model.Events.StartEvent>(Model.Events.StartEvent);
  }

  public getStartEventById(startEventId: string): Model.Events.StartEvent {

    const startEvents: Array<Model.Events.StartEvent> = this.getStartEvents();

    const matchingStartEvent: Model.Events.StartEvent = startEvents.find((startEvent: Model.Events.StartEvent): boolean => {
      return startEvent.id === startEventId;
    });

    if (!matchingStartEvent) {
      throw new NotFoundError(`Start event with id '${startEventId}' not found!`);
    }

    return matchingStartEvent;
  }

  public getEndEvents(): Array<Model.Events.EndEvent> {
    return this._filterFlowNodesByType<Model.Events.EndEvent>(Model.Events.EndEvent);
  }

  public getUserTasks(): Array<Model.Activities.UserTask> {
    return this._filterFlowNodesByType<Model.Activities.UserTask>(Model.Activities.UserTask);
  }

  public getIncomingSequenceFlowsFor(flowNodeId: string): Array<Model.Types.SequenceFlow> {
    return this.processModel.sequenceFlows.filter((sequenceFlow: Model.Types.SequenceFlow) => {
      return sequenceFlow.targetRef === flowNodeId;
    });
  }

  public getOutgoingSequenceFlowsFor(flowNodeId: string): Array<Model.Types.SequenceFlow> {
    return this.processModel.sequenceFlows.filter((sequenceFlow: Model.Types.SequenceFlow) => {
      return sequenceFlow.sourceRef === flowNodeId;
    });
  }

  public getSequenceFlowBetween(flowNode: Model.Base.FlowNode, nextFlowNode: Model.Base.FlowNode): Model.Types.SequenceFlow {

    if (!nextFlowNode) {
      return undefined;
    }

    const sequenceFlowsTargetingNextFlowNode: Array<Model.Types.SequenceFlow> =
      this.processModel.sequenceFlows.filter((sequenceFlow: Model.Types.SequenceFlow) => {
        return sequenceFlow.targetRef === nextFlowNode.id;
      });

    for (const sequenceFlow of sequenceFlowsTargetingNextFlowNode) {
      if (sequenceFlow.sourceRef === flowNode.id) {
        return sequenceFlow;
      }

      const sourceNode: Model.Base.FlowNode = this.getFlowNodeById(sequenceFlow.sourceRef);

      if (sourceNode.bpmnType === BpmnType.boundaryEvent) {
        const isBoundaryEventAttachedToSourceNode: boolean = (sourceNode as Model.Events.BoundaryEvent).attachedToRef === flowNode.id;

        if (isBoundaryEventAttachedToSourceNode) {
          return sequenceFlow;
        }
      }
    }
  }

  // TODO:
  // There is no Support for nested ParallelGateways, or ExclusiveGateways within ParallelGateways.
  // Currently the next Parallel Gateway is always taken as the Parallel Join Gateway.
  // This also effectively prevents us from using TerminateEndEvents reliably, because
  // it is always assumed that every branch must ultimately lead back to the Join Gateway.
  public getJoinGatewayFor(parallelGatewayNode: Model.Gateways.ParallelGateway): Model.Gateways.ParallelGateway {

    const nextFlowNode: Model.Base.FlowNode = this.getNextFlowNodeFor(parallelGatewayNode);

    const flowNodeIsParallelGateway: boolean = parallelGatewayNode.bpmnType === BpmnType.parallelGateway;

    if (!flowNodeIsParallelGateway) {
      return this.getJoinGatewayFor(nextFlowNode as Model.Gateways.ParallelGateway);
    }

    const flowNodeIsJoinGateway: boolean = parallelGatewayNode.gatewayDirection !== Model.Gateways.GatewayDirection.Diverging;

    if (flowNodeIsParallelGateway && flowNodeIsJoinGateway) {
      return parallelGatewayNode;
    }

    return this.getJoinGatewayFor(nextFlowNode as Model.Gateways.ParallelGateway);
  }

  public getBoundaryEventsFor(flowNode: Model.Base.FlowNode): Array<Model.Events.BoundaryEvent> {
    const boundaryEvents: Array<Model.Base.FlowNode> = this.processModel.flowNodes.filter((currentFlowNode: Model.Base.FlowNode) => {

      const isBoundaryEvent: boolean = currentFlowNode.bpmnType === BpmnType.boundaryEvent;
      const boundaryEventIsAttachedToFlowNode: boolean = (currentFlowNode as Model.Events.BoundaryEvent).attachedToRef === flowNode.id;

      return isBoundaryEvent && boundaryEventIsAttachedToFlowNode;
    });

    return boundaryEvents as Array<Model.Events.BoundaryEvent>;
  }

  // TODO: This does not work for gateways because it always assumes that only one outgoing SequenceFlow is present.
  public getNextFlowNodeFor(flowNode: Model.Base.FlowNode): Model.Base.FlowNode {

    // First find the SequenceFlow that describes the next target after the FlowNode
    const flow: Model.Types.SequenceFlow = this.processModel.sequenceFlows.find((sequenceFlow: Model.Types.SequenceFlow) => {
      return sequenceFlow.sourceRef === flowNode.id;
    });

    const flowhasNoTarget: boolean = !flow || !flow.targetRef;
    if (flowhasNoTarget) {
      return undefined;
    }

    // Then find the target FlowNode of the SequenceFlow
    const nextFlowNode: Model.Base.FlowNode = this.processModel.flowNodes.find((currentFlowNode: Model.Base.FlowNode) => {
      return currentFlowNode.id === flow.targetRef;
    });

    return nextFlowNode;
  }

  public getFlowNodeById(flowNodeId: string): Model.Base.FlowNode {
    const nextFlowNode: Model.Base.FlowNode = this.processModel.flowNodes.find((currentFlowNode: Model.Base.FlowNode) => {
      return currentFlowNode.id === flowNodeId;
    });

    return nextFlowNode;
  }

  public getLinkCatchEventsByLinkName(linkName: string): Array<Model.Events.IntermediateCatchEvent> {

    const matchingIntermediateCatchEvents: Array<Model.Base.FlowNode> =
      this.processModel.flowNodes.filter((flowNode: Model.Base.FlowNode): boolean => {

        const flowNodeAsCatchEvent: Model.Events.IntermediateCatchEvent = flowNode as Model.Events.IntermediateCatchEvent;

        const isNoIntermediateLinkCatchEvent: boolean =
          !(flowNode instanceof Model.Events.IntermediateCatchEvent) ||
          flowNodeAsCatchEvent.linkEventDefinition === undefined;

        if (isNoIntermediateLinkCatchEvent) {
          return false;
        }

        const linkHasMatchingName: boolean = flowNodeAsCatchEvent.linkEventDefinition.name === linkName;

        return linkHasMatchingName;
      });

    return <Array<Model.Events.IntermediateCatchEvent>> matchingIntermediateCatchEvents;
  }

  private _filterFlowNodesByType<TFlowNode extends Model.Base.FlowNode>(type: Model.Base.IConstructor<TFlowNode>): Array<TFlowNode> {

    const flowNodes: Array<Model.Base.FlowNode> = this.processModel.flowNodes.filter((flowNode: Model.Base.FlowNode) => {
      return flowNode instanceof type;
    });

    return flowNodes as Array<TFlowNode>;
  }
}
