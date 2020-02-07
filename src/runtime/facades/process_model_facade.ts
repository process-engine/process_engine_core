import {BadRequestError, InternalServerError, NotFoundError} from '@essential-projects/errors_ts';
import {BpmnType, Model} from '@process-engine/persistence_api.contracts';
import {IProcessModelFacade} from '@process-engine/process_engine_contracts';

import {SubProcessModelFacade} from './index';

export class ProcessModelFacade implements IProcessModelFacade {

  protected processModel: Model.Process;

  constructor(processModel: Model.Process) {
    if (!processModel) {
      throw new BadRequestError('Must provide a ProcessModel in order to use the ProcessModelFacade!');
    }
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
    return this.processModel.laneSet?.lanes?.length > 0;
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

    const flowhasNoSource = !(sequenceFlows?.length > 0);
    if (flowhasNoSource) {
      return undefined;
    }

    // Then find the source FlowNodes for each SequenceFlow
    const previousFlowNodes = sequenceFlows.map((currentSequenceFlow: Model.ProcessElements.SequenceFlow): Model.Base.FlowNode => {
      const sourceNode: Model.Base.FlowNode = this.processModel
        .flowNodes
        .find((currentFlowNode: Model.Base.FlowNode): boolean => currentFlowNode.id === currentSequenceFlow.sourceRef);

      // If the sourceNode happens to be a BoundaryEvent, return the Node that the BoundaryEvent is attached to.
      if (sourceNode.bpmnType === BpmnType.boundaryEvent) {
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
        flowNodeAsCatchEvent.linkEventDefinition == undefined;

      if (isNoIntermediateLinkCatchEvent) {
        return false;
      }

      const linkHasMatchingName = flowNodeAsCatchEvent.linkEventDefinition.name === linkName;

      return linkHasMatchingName;
    });

    return matchingIntermediateCatchEvents as Array<Model.Events.IntermediateCatchEvent>;
  }

  /**
   * Takes a Split Gateway of any type and determines which Join Gateway is its counterpart.
   *
   * Note:
   * This should not be used for Exclusive Gateways, because these are not required to have a Join Gateway.
   *
   * @param   splitGateway         The Split Gateway for which to search the corresponding Joing Gateway.
   * @param   parentSplitGateway   When dealing with a nested Split Gateway, this will contain the parent.
   * @returns                      The discovered Join Gateway. Will return undefined, if no Gateway was found.
   * @throws {InternalServerError} If the branches lead to multiple Join Gateways. This inidcates an invalid or broken BPMN.
   */
  public findJoinGatewayAfterSplitGateway(splitGateway: Model.Gateways.Gateway, parentSplitGateway?: Model.Gateways.Gateway): Model.Gateways.Gateway {

    const flowNodesAfterSplitGateway = this.getNextFlowNodesFor(splitGateway);

    const discoveredJoinGateways: Array<Model.Gateways.Gateway> = [];

    // Travel through all branches and find out where they ultimately lead to
    for (const flowNode of flowNodesAfterSplitGateway) {
      const discoveredJoinGateway = this.travelToJoinGateway(splitGateway, flowNode, parentSplitGateway);

      if (discoveredJoinGateway) {
        discoveredJoinGateways.push(discoveredJoinGateway);
      }
    }

    // If only one gateway was discovered, no validation is necessary.
    if (discoveredJoinGateways.length <= 1) {
      return discoveredJoinGateways[0];
    }

    // Ensure we have the right gateway, by determining if all paths ended at the same one.
    // If not, the BPMN is most likely invalid or broken.
    const gatewayId = discoveredJoinGateways[0].id;
    const allBranchesLeadToSameJoinGateway = discoveredJoinGateways.every((entry) => entry.id === gatewayId);

    if (!allBranchesLeadToSameJoinGateway) {
      const error = new InternalServerError(`Failed to discover definitive Join Gateway for Split Gateway ${splitGateway.id}! Check your BPMN!`);
      error.additionalInformation = {
        splitGateway: splitGateway,
        parentSplitGateway: parentSplitGateway,
        discoveredJoinGateways: discoveredJoinGateways,
      };

      throw error;
    }

    return discoveredJoinGateways[0];
  }

  protected filterFlowNodesByType<TFlowNode extends Model.Base.FlowNode>(type: Model.Base.IConstructor<TFlowNode>): Array<TFlowNode> {
    const flowNodes = this.processModel.flowNodes.filter((flowNode: Model.Base.FlowNode): boolean => flowNode instanceof type);

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
  protected findLaneForFlowNodeIdFromLaneSet(flowNodeId: string, laneSet: Model.ProcessElements.LaneSet): Model.ProcessElements.Lane {

    for (const lane of laneSet.lanes) {

      let matchingLane: Model.ProcessElements.Lane;

      const laneHasChildLaneSet = lane.childLaneSet?.lanes?.length > 0;

      if (laneHasChildLaneSet) {
        matchingLane = this.findLaneForFlowNodeIdFromLaneSet(flowNodeId, lane.childLaneSet);
      } else {
        const laneContainsFlowNode = lane.flowNodeReferences.some((flowNodeReference: string): boolean => flowNodeReference === flowNodeId);
        if (laneContainsFlowNode) {
          matchingLane = lane;
        }
      }

      if (matchingLane != undefined) {
        return matchingLane;
      }
    }

    return undefined;
  }

  private travelToJoinGateway(
    startSplitGateway: Model.Gateways.Gateway,
    startingFlowNode: Model.Base.FlowNode,
    parentSplitGateway?: Model.Gateways.Gateway,
  ): Model.Gateways.Gateway {

    let currentFlowNode = startingFlowNode;

    // eslint-disable-next-line
    while (true) {
      const endOfBranchReached = currentFlowNode == undefined;
      if (endOfBranchReached) {
        return undefined;
      }

      const bpmnTypesMatch = currentFlowNode.bpmnType === startSplitGateway.bpmnType;
      const flowNodeIsJoinGateway = (currentFlowNode as Model.Gateways.Gateway).gatewayDirection != Model.Gateways.GatewayDirection.Diverging;

      if (bpmnTypesMatch && flowNodeIsJoinGateway) {
        return currentFlowNode as Model.Gateways.Gateway;
      }

      const flowNodeIsAGateway =
        currentFlowNode.bpmnType === BpmnType.parallelGateway ||
        currentFlowNode.bpmnType === BpmnType.exclusiveGateway ||
        currentFlowNode.bpmnType === BpmnType.inclusiveGateway ||
        currentFlowNode.bpmnType === BpmnType.eventBasedGateway ||
        currentFlowNode.bpmnType === BpmnType.complexGateway;

      const isSplitGateway = (currentFlowNode as Model.Gateways.Gateway).gatewayDirection === Model.Gateways.GatewayDirection.Diverging;
      const typeMatchesParentGateway = currentFlowNode.bpmnType === parentSplitGateway?.bpmnType;

      if (flowNodeIsAGateway && isSplitGateway) {
        const nestedJoinGateway = this.findJoinGatewayAfterSplitGateway(currentFlowNode as Model.Gateways.Gateway, startSplitGateway);
        currentFlowNode = nestedJoinGateway;
      } else if (flowNodeIsAGateway && typeMatchesParentGateway) {
        return currentFlowNode as Model.Gateways.Gateway;
      }

      const nextFlowNodes = this.getNextFlowNodesFor(currentFlowNode);
      currentFlowNode = nextFlowNodes?.length > 0 ? nextFlowNodes[0] : undefined;
    }
  }

}
