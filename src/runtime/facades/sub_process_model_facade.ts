import {InternalServerError, NotFoundError, NotImplementedError} from '@essential-projects/errors_ts';
import {BpmnType, Model} from '@process-engine/persistence_api.contracts';

import {ProcessModelFacade} from './process_model_facade';

export class SubProcessModelFacade extends ProcessModelFacade {

  private subProcessDefinition: Model.Activities.SubProcess;

  constructor(processDefinition: Model.Process, subProcessDefinition: Model.Activities.SubProcess) {
    super(processDefinition);
    this.subProcessDefinition = subProcessDefinition;
  }

  public getStartEvents(): Array<Model.Events.StartEvent> {
    return this.filterFlowNodesByType<Model.Events.StartEvent>(Model.Events.StartEvent);
  }

  public getSingleStartEvent(): Model.Events.StartEvent {
    const startEvents = this.getStartEvents();

    return startEvents[0];
  }

  public getStartEventById(startEventId: string): Model.Events.StartEvent {

    const startEvents = this.getStartEvents();

    const matchingStartEvent = startEvents.find((startEvent: Model.Events.StartEvent): boolean => {
      return startEvent.id === startEventId;
    });

    if (!matchingStartEvent) {
      throw new NotFoundError(`Start event with id '${startEventId}' not found!`);
    }

    return matchingStartEvent;
  }

  public getEndEvents(): Array<Model.Events.EndEvent> {
    return this.filterFlowNodesByType<Model.Events.EndEvent>(Model.Events.EndEvent);
  }

  public getUserTasks(): Array<Model.Activities.UserTask> {
    return this.filterFlowNodesByType<Model.Activities.UserTask>(Model.Activities.UserTask);
  }

  public getFlowNodeById(flowNodeId: string): Model.Base.FlowNode {
    return this.subProcessDefinition.flowNodes.find((currentFlowNode: Model.Base.FlowNode): boolean => currentFlowNode.id === flowNodeId);
  }

  public getProcessModelHasLanes(): boolean {
    throw new NotImplementedError('Subprocesses cannot have lanes!');
  }

  public getIncomingSequenceFlowsFor(flowNodeId: string): Array<Model.ProcessElements.SequenceFlow> {

    const flowNodeExists = this.subProcessDefinition.flowNodes.some((flowNode): boolean => flowNode.id === flowNodeId);
    if (!flowNodeExists) {
      throw new NotFoundError(`FlowNode with ID ${flowNodeId} not found!`);
    }

    return this.subProcessDefinition
      .sequenceFlows
      .filter((sequenceFlow: Model.ProcessElements.SequenceFlow): boolean => sequenceFlow.targetRef === flowNodeId);
  }

  public getOutgoingSequenceFlowsFor(flowNodeId: string): Array<Model.ProcessElements.SequenceFlow> {

    const flowNodeExists = this.subProcessDefinition.flowNodes.some((flowNode): boolean => flowNode.id === flowNodeId);
    if (!flowNodeExists) {
      throw new NotFoundError(`FlowNode with ID ${flowNodeId} not found!`);
    }

    return this.subProcessDefinition
      .sequenceFlows
      .filter((sequenceFlow: Model.ProcessElements.SequenceFlow): boolean => sequenceFlow.sourceRef === flowNodeId);
  }

  public getSequenceFlowBetween(sourceNode: Model.Base.FlowNode, targetNode: Model.Base.FlowNode): Model.ProcessElements.SequenceFlow {

    if (!sourceNode || !targetNode) {
      return undefined;
    }

    const sourceNodeBoundaryEvents = this.getBoundaryEventsFor(sourceNode);

    return this.subProcessDefinition.sequenceFlows.find((sequenceFlow: Model.ProcessElements.SequenceFlow): boolean => {
      const sourceRefMatches = sequenceFlow.sourceRef === sourceNode.id;
      const targetRefMatches = sequenceFlow.targetRef === targetNode.id;

      const isFullMatch = sourceRefMatches && targetRefMatches;

      // If targetRef matches, but sourceRef does not, check if sourceRef
      // points to a BoundaryEvent that is attached to the sourceNode.
      // If so, the sourceRef still points to the correct FlowNode.
      if (!isFullMatch && targetRefMatches) {

        const sourceRefPointsToBoundaryEventOfSourceNode =
          sourceNodeBoundaryEvents.some((node: Model.Events.BoundaryEvent): boolean => node.attachedToRef === sourceNode.id);

        return sourceRefPointsToBoundaryEventOfSourceNode;
      }

      return isFullMatch;
    });
  }

  public getBoundaryEventsFor(flowNode: Model.Base.FlowNode): Array<Model.Events.BoundaryEvent> {

    const boundaryEvents = this.subProcessDefinition.flowNodes.filter((currentFlowNode: Model.Base.FlowNode): boolean => {
      const isBoundaryEvent = currentFlowNode.bpmnType === BpmnType.boundaryEvent;
      const boundaryEventIsAttachedToFlowNode = (currentFlowNode as Model.Events.BoundaryEvent).attachedToRef === flowNode.id;

      return isBoundaryEvent && boundaryEventIsAttachedToFlowNode;
    });

    return boundaryEvents as Array<Model.Events.BoundaryEvent>;
  }

  public getPreviousFlowNodesFor(flowNode: Model.Base.FlowNode): Array<Model.Base.FlowNode> {

    // First find the SequenceFlows that contain the FlowNodes next targets
    const sequenceFlows = this.subProcessDefinition.sequenceFlows.filter((sequenceFlow: Model.ProcessElements.SequenceFlow): boolean => {
      return sequenceFlow.targetRef === flowNode.id;
    });

    const flowhasNoSource = !(sequenceFlows?.length > 0);
    if (flowhasNoSource) {
      return undefined;
    }

    // Then find the source FlowNodes for each SequenceFlow
    const previousFlowNodes = sequenceFlows.map((currentSequenceFlow: Model.ProcessElements.SequenceFlow): Model.Base.FlowNode => {

      const sourceNode = this.subProcessDefinition
        .flowNodes
        .find((currentFlowNode: Model.Base.FlowNode): boolean => currentFlowNode.id === currentSequenceFlow.sourceRef);

      // If the sourceNode happens to be a BoundaryEvent, return the Node that the BoundaryEvent is attached to.
      if (sourceNode.bpmnType === BpmnType.boundaryEvent) {
        return this.subProcessDefinition.flowNodes.find((currentFlowNode: Model.Base.FlowNode): boolean => {
          return currentFlowNode.id === (sourceNode as Model.Events.BoundaryEvent).attachedToRef;
        });
      }

      return sourceNode;
    });

    return previousFlowNodes;
  }

  public getNextFlowNodesFor(flowNode: Model.Base.FlowNode): Array<Model.Base.FlowNode> {

    // First find the SequenceFlows that contain the FlowNodes next targets
    const sequenceFlows = this.subProcessDefinition.sequenceFlows.filter((sequenceFlow: Model.ProcessElements.SequenceFlow): boolean => {
      return sequenceFlow.sourceRef === flowNode.id;
    });

    const flowhasNoTarget = !(sequenceFlows?.length > 0);
    if (flowhasNoTarget) {
      return undefined;
    }

    // If multiple SequenceFlows were found, make sure that the FlowNode is a Gateway,
    // since only gateways are supposed to contain multiple outgoing SequenceFlows.
    const flowNodeIsAGateway = flowNode.bpmnType === BpmnType.parallelGateway ||
                               flowNode.bpmnType === BpmnType.exclusiveGateway ||
                               flowNode.bpmnType === BpmnType.inclusiveGateway ||
                               flowNode.bpmnType === BpmnType.eventBasedGateway ||
                               flowNode.bpmnType === BpmnType.complexGateway;

    const tooManyOutgoingSequnceFlows = sequenceFlows.length > 1 && !flowNodeIsAGateway;
    if (tooManyOutgoingSequnceFlows) {
      throw new InternalServerError(`Non-Gateway FlowNode '${flowNode.id}' has more than one outgoing SequenceFlow!`);
    }

    // Then find the target FlowNodes for each SequenceFlow
    const nextFlowNodes = sequenceFlows.map((sequenceFlow: Model.ProcessElements.SequenceFlow): Model.Base.FlowNode => {
      return this.subProcessDefinition
        .flowNodes
        .find((node: Model.Base.FlowNode): boolean => { return node.id === sequenceFlow.targetRef; });
    });

    return nextFlowNodes;
  }

  public getLaneForFlowNode(flowNodeId: string): Model.ProcessElements.Lane {

    const flowNodeExists = this.subProcessDefinition.flowNodes.some((flowNode): boolean => flowNode.id === flowNodeId);
    if (!flowNodeExists) {
      throw new NotFoundError(`FlowNode with ID ${flowNodeId} not found!`);
    }

    const processModelHasNoLanes = !super.getProcessModelHasLanes();
    if (processModelHasNoLanes) {
      return undefined;
    }

    const matchingLane = super.findLaneForFlowNodeIdFromLaneSet(this.subProcessDefinition.id, this.processModel.laneSet);

    return matchingLane;
  }

  public getLinkCatchEventsByLinkName(linkName: string): Array<Model.Events.IntermediateCatchEvent> {

    const matchingIntermediateCatchEvents = this.subProcessDefinition.flowNodes.filter((flowNode: Model.Base.FlowNode): boolean => {
      const flowNodeAsCatchEvent = flowNode as Model.Events.IntermediateCatchEvent;

      const isNoIntermediateLinkCatchEvent =
        !(flowNode instanceof Model.Events.IntermediateCatchEvent) ||
        flowNodeAsCatchEvent.linkEventDefinition == undefined;

      if (isNoIntermediateLinkCatchEvent) {
        return false;
      }

      const linkHasMatchingName = flowNodeAsCatchEvent.linkEventDefinition.name === linkName;

      return linkHasMatchingName;
    });

    return matchingIntermediateCatchEvents as Array<Model.Events.IntermediateCatchEvent>;
  }

  protected filterFlowNodesByType<TFlowNode extends Model.Base.FlowNode>(type: Model.Base.IConstructor<TFlowNode>): Array<TFlowNode> {
    const flowNodes = this.subProcessDefinition.flowNodes.filter((flowNode: Model.Base.FlowNode): boolean => {
      return flowNode instanceof type;
    });

    return flowNodes as Array<TFlowNode>;
  }

}
