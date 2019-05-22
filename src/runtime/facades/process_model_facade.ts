import {InternalServerError, NotFoundError} from '@essential-projects/errors_ts';
import {IProcessModelFacade} from '@process-engine/process_engine_contracts';
import {BpmnType, Model} from '@process-engine/process_model.contracts';

import {SubProcessModelFacade} from './index';

export class ProcessModelFacade implements IProcessModelFacade {

  protected processModel: Model.Process;

  constructor(processModel: Model.Process) {
    this.processModel = processModel;
  }

  public getIsExecutable(): boolean {
    return this.processModel.isExecutable;
  }

  public getSubProcessModelFacade(subProcessNode: Model.Activities.SubProcess): IProcessModelFacade {
    return new SubProcessModelFacade(this.processModel, subProcessNode);
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
    return this.processModel.flowNodes.find((currentFlowNode: Model.Base.FlowNode): boolean => currentFlowNode.id === flowNodeId);
  }

  public getProcessModelHasLanes(): boolean {

    return this.processModel.laneSet !== undefined
            && this.processModel.laneSet.lanes !== undefined
            && this.processModel.laneSet.lanes.length > 0;
  }

  public getLaneForFlowNode(flowNodeId: string): Model.ProcessElements.Lane {

    const processModelHasNoLanes = !this.getProcessModelHasLanes();
    if (processModelHasNoLanes) {
      return undefined;
    }

    const matchingLane = this.findLaneForFlowNodeIdFromLaneSet(flowNodeId, this.processModel.laneSet);

    return matchingLane;
  }

  public getIncomingSequenceFlowsFor(flowNodeId: string): Array<Model.ProcessElements.SequenceFlow> {
    return this.processModel
      .sequenceFlows
      .filter((sequenceFlow: Model.ProcessElements.SequenceFlow): boolean => sequenceFlow.targetRef === flowNodeId);
  }

  public getOutgoingSequenceFlowsFor(flowNodeId: string): Array<Model.ProcessElements.SequenceFlow> {
    return this.processModel
      .sequenceFlows
      .filter((sequenceFlow: Model.ProcessElements.SequenceFlow): boolean => sequenceFlow.sourceRef === flowNodeId);
  }

  public getSequenceFlowBetween(sourceNode: Model.Base.FlowNode, targetNode: Model.Base.FlowNode): Model.ProcessElements.SequenceFlow {

    if (!sourceNode || !targetNode) {
      return undefined;
    }

    const sourceNodeBoundaryEvents = this.getBoundaryEventsFor(sourceNode);

    return this.processModel.sequenceFlows.find((sequenceFlow: Model.ProcessElements.SequenceFlow): boolean => {
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

    const boundaryEvents = this.processModel.flowNodes.filter((currentFlowNode: Model.Base.FlowNode): boolean => {
      const isBoundaryEvent = currentFlowNode.bpmnType === BpmnType.boundaryEvent;
      const boundaryEventIsAttachedToFlowNode = (currentFlowNode as Model.Events.BoundaryEvent).attachedToRef === flowNode.id;

      return isBoundaryEvent && boundaryEventIsAttachedToFlowNode;
    });

    return boundaryEvents as Array<Model.Events.BoundaryEvent>;
  }

  public getPreviousFlowNodesFor(flowNode: Model.Base.FlowNode): Array<Model.Base.FlowNode> {

    // First find the SequenceFlows that contain the FlowNodes next targets
    const sequenceFlows = this.processModel.sequenceFlows.filter((sequenceFlow: Model.ProcessElements.SequenceFlow): boolean => {
      return sequenceFlow.targetRef === flowNode.id;
    });

    const flowhasNoSource = !sequenceFlows || sequenceFlows.length === 0;
    if (flowhasNoSource) {
      return undefined;
    }

    // Then find the source FlowNodes for each SequenceFlow
    const previousFlowNodes = sequenceFlows.map((currentSequenceFlow: Model.ProcessElements.SequenceFlow): Model.Base.FlowNode => {
      const sourceNode: Model.Base.FlowNode =
        this.processModel
          .flowNodes
          .find((currentFlowNode: Model.Base.FlowNode): boolean => currentFlowNode.id === currentSequenceFlow.sourceRef);

      // If the sourceNode happens to be a BoundaryEvent, return the Node that the BoundaryEvent is attached to.
      const sourceNodeIsBoundaryEvent = sourceNode.bpmnType === BpmnType.boundaryEvent;
      if (sourceNodeIsBoundaryEvent) {
        return this.processModel.flowNodes.find((currentFlowNode: Model.Base.FlowNode): boolean => {
          return currentFlowNode.id === (sourceNode as Model.Events.BoundaryEvent).attachedToRef;
        });
      }

      return sourceNode;
    });

    return previousFlowNodes;
  }

  public getNextFlowNodesFor(flowNode: Model.Base.FlowNode): Array<Model.Base.FlowNode> {

    // First find the SequenceFlows that contain the FlowNodes next targets
    const sequenceFlows = this.processModel.sequenceFlows.filter((sequenceFlow: Model.ProcessElements.SequenceFlow): boolean => {
      return sequenceFlow.sourceRef === flowNode.id;
    });

    const flowhasNoTarget = !sequenceFlows || sequenceFlows.length === 0;
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
    const nextFlowNodes = sequenceFlows.map((currentSequenceFlow: Model.ProcessElements.SequenceFlow): Model.Base.FlowNode => {
      return this.processModel
        .flowNodes
        .find((currentFlowNode: Model.Base.FlowNode): boolean => currentFlowNode.id === currentSequenceFlow.targetRef);
    });

    return nextFlowNodes;
  }

  public getLinkCatchEventsByLinkName(linkName: string): Array<Model.Events.IntermediateCatchEvent> {

    const matchingIntermediateCatchEvents = this.processModel.flowNodes.filter((flowNode: Model.Base.FlowNode): boolean => {
      const flowNodeAsCatchEvent = flowNode as Model.Events.IntermediateCatchEvent;

      const isNoIntermediateLinkCatchEvent =
        !(flowNode instanceof Model.Events.IntermediateCatchEvent) ||
        flowNodeAsCatchEvent.linkEventDefinition === undefined;

      if (isNoIntermediateLinkCatchEvent) {
        return false;
      }

      const linkHasMatchingName = flowNodeAsCatchEvent.linkEventDefinition.name === linkName;

      return linkHasMatchingName;
    });

    return matchingIntermediateCatchEvents as Array<Model.Events.IntermediateCatchEvent>;
  }

  private filterFlowNodesByType<TFlowNode extends Model.Base.FlowNode>(type: Model.Base.IConstructor<TFlowNode>): Array<TFlowNode> {
    const flowNodes = this.processModel.flowNodes.filter((flowNode: Model.Base.FlowNode): boolean => {
      return flowNode instanceof type;
    });

    return flowNodes as Array<TFlowNode>;
  }

  /**
   * Iterates over the lanes of the given laneSet and determines if one of
   * the lanes contains a FlowNode with the given ID.
   *
   * If the lane has a childLaneSet, the FlowNodeID will be searched within
   * that child lane set.
   *
   * @param   flowNodeId The FlowNodeId to find.
   * @param   laneSet    The LaneSet in which to search for the FlowNodeId.
   * @returns            Either the lane containing the FlowNodeId,
   *                     or undefined, if not matching lane was found.
   */
  private findLaneForFlowNodeIdFromLaneSet(flowNodeId: string, laneSet: Model.ProcessElements.LaneSet): Model.ProcessElements.Lane {

    for (const lane of laneSet.lanes) {

      let matchingLane: Model.ProcessElements.Lane;

      const laneHasChildLaneSet = lane.childLaneSet !== undefined
                               && lane.childLaneSet.lanes !== undefined
                               && lane.childLaneSet.lanes.length > 0;

      if (laneHasChildLaneSet) {
        matchingLane = this.findLaneForFlowNodeIdFromLaneSet(flowNodeId, lane.childLaneSet);
      } else {
        const laneContainsFlowNode = lane.flowNodeReferences.some((flowNodeReference: string): boolean => flowNodeReference === flowNodeId);
        if (laneContainsFlowNode) {
          matchingLane = lane;
        }
      }

      const matchFound = matchingLane !== undefined;
      if (matchFound) {
        return matchingLane;
      }
    }

    return undefined;
  }

}
