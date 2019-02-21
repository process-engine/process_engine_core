import {BadRequestError, InternalServerError, NotFoundError} from '@essential-projects/errors_ts';
import {IProcessModelFacade} from '@process-engine/process_engine_contracts';
import {BpmnType, Model} from '@process-engine/process_model.contracts';

import {SubProcessModelFacade} from './index';

export class ProcessModelFacade implements IProcessModelFacade {

  private _processModel: Model.Process;

  constructor(processModel: Model.Process) {
    this._processModel = processModel;
  }

  protected get processModel(): Model.Process {
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

  public getSingleStartEvent(): Model.Events.StartEvent {
    const startEvents: Array<Model.Events.StartEvent> = this.getStartEvents();
    const multipleStartEventsDefined: boolean = startEvents.length > 1;

    if (multipleStartEventsDefined) {
      throw new BadRequestError('The Process contains multiple StartEvents');
    }

    return startEvents[0];
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

  public getFlowNodeById(flowNodeId: string): Model.Base.FlowNode {
    return this.processModel.flowNodes.find((currentFlowNode: Model.Base.FlowNode) => currentFlowNode.id === flowNodeId);
  }

  public getIncomingSequenceFlowsFor(flowNodeId: string): Array<Model.ProcessElements.SequenceFlow> {
    return this.processModel.sequenceFlows.filter((sequenceFlow: Model.ProcessElements.SequenceFlow) => sequenceFlow.targetRef === flowNodeId);
  }

  public getOutgoingSequenceFlowsFor(flowNodeId: string): Array<Model.ProcessElements.SequenceFlow> {
    return this.processModel.sequenceFlows.filter((sequenceFlow: Model.ProcessElements.SequenceFlow) => sequenceFlow.sourceRef === flowNodeId);
  }

  public getSequenceFlowBetween(sourceNode: Model.Base.FlowNode, targetNode: Model.Base.FlowNode): Model.ProcessElements.SequenceFlow {

    if (!sourceNode || !targetNode) {
      return undefined;
    }

    const sourceNodeBoundaryEvents: Array<Model.Events.BoundaryEvent> = this.getBoundaryEventsFor(sourceNode);

    return this.processModel.sequenceFlows.find((sequenceFlow: Model.ProcessElements.SequenceFlow): boolean => {
      const sourceRefMatches: boolean = sequenceFlow.sourceRef === sourceNode.id;
      const targetRefMatches: boolean = sequenceFlow.targetRef === targetNode.id;

      const isFullMatch: boolean = sourceRefMatches && targetRefMatches;

      // If targetRef matches, but sourceRef does not, check if sourceRef
      // points to a BoundaryEvent that is attached to the sourceNode.
      // If so, the sourceRef still points to the correct FlowNode.
      if (!isFullMatch && targetRefMatches) {

        const sourceRefPointsToBoundaryEventOfSourceNode: boolean =
          sourceNodeBoundaryEvents.some((node: Model.Events.BoundaryEvent) => node.attachedToRef === sourceNode.id);

        return sourceRefPointsToBoundaryEventOfSourceNode;
      }

      return isFullMatch;
    });
  }

  public getBoundaryEventsFor(flowNode: Model.Base.FlowNode): Array<Model.Events.BoundaryEvent> {
    const boundaryEvents: Array<Model.Base.FlowNode> =
      this.processModel.flowNodes.filter((currentFlowNode: Model.Base.FlowNode) => {

        const isBoundaryEvent: boolean = currentFlowNode.bpmnType === BpmnType.boundaryEvent;
        const boundaryEventIsAttachedToFlowNode: boolean = (currentFlowNode as Model.Events.BoundaryEvent).attachedToRef === flowNode.id;

        return isBoundaryEvent && boundaryEventIsAttachedToFlowNode;
      });

    return boundaryEvents as Array<Model.Events.BoundaryEvent>;
  }

  public getPreviousFlowNodesFor(flowNode: Model.Base.FlowNode): Array<Model.Base.FlowNode> {

    // First find the SequenceFlows that contain the FlowNodes next targets
    const sequenceFlows: Array<Model.ProcessElements.SequenceFlow> =
      this.processModel.sequenceFlows.filter((sequenceFlow: Model.ProcessElements.SequenceFlow) => {
        return sequenceFlow.targetRef === flowNode.id;
      });

    const flowhasNoSource: boolean = !sequenceFlows || sequenceFlows.length === 0;
    if (flowhasNoSource) {
      return undefined;
    }

    // Then find the source FlowNodes for each SequenceFlow
    const previousFlowNodes: Array<Model.Base.FlowNode> =
      sequenceFlows.map((currentSequenceFlow: Model.ProcessElements.SequenceFlow) => {

        const sourceNode: Model.Base.FlowNode =
          this.processModel.flowNodes.find((currentFlowNode: Model.Base.FlowNode) => currentFlowNode.id === currentSequenceFlow.sourceRef);

        // If the sourceNode happens to be a BoundaryEvent, return the Node that the BoundaryEvent is attached to.
        const sourceNodeIsBoundaryEvent: boolean = sourceNode.bpmnType === BpmnType.boundaryEvent;
        if (sourceNodeIsBoundaryEvent) {
          return this.processModel.flowNodes.find((currentFlowNode: Model.Base.FlowNode) => {
            return currentFlowNode.id === (sourceNode as Model.Events.BoundaryEvent).attachedToRef;
          });
        }

        return sourceNode;
      });

    return previousFlowNodes;
  }

  public getNextFlowNodesFor(flowNode: Model.Base.FlowNode): Array<Model.Base.FlowNode> {

    // First find the SequenceFlows that contain the FlowNodes next targets
    const sequenceFlows: Array<Model.ProcessElements.SequenceFlow> =
      this.processModel.sequenceFlows.filter((sequenceFlow: Model.ProcessElements.SequenceFlow) => {
        return sequenceFlow.sourceRef === flowNode.id;
      });

    const flowhasNoTarget: boolean = !sequenceFlows || sequenceFlows.length === 0;
    if (flowhasNoTarget) {
      return undefined;
    }

    // If multiple SequenceFlows were found, make sure that the FlowNode is a Gateway,
    // since only gateways are supposed to contain multiple outgoing SequenceFlows.
    const flowNodeIsAGateway: boolean = flowNode.bpmnType === BpmnType.parallelGateway ||
                                        flowNode.bpmnType === BpmnType.exclusiveGateway ||
                                        flowNode.bpmnType === BpmnType.inclusiveGateway ||
                                        flowNode.bpmnType === BpmnType.eventBasedGateway ||
                                        flowNode.bpmnType === BpmnType.complexGateway;

    const tooManyOutgoingSequnceFlows: boolean = sequenceFlows.length > 1 && !flowNodeIsAGateway;
    if (tooManyOutgoingSequnceFlows) {
      throw new InternalServerError(`Non-Gateway FlowNode '${flowNode.id}' has more than one outgoing SequenceFlow!`);
    }

    // Then find the target FlowNodes for each SequenceFlow
    const nextFlowNodes: Array<Model.Base.FlowNode> =
      sequenceFlows.map((currentSequenceFlow: Model.ProcessElements.SequenceFlow) => {
        return this.processModel.flowNodes.find((currentFlowNode: Model.Base.FlowNode) => currentFlowNode.id === currentSequenceFlow.targetRef);
      });

    return nextFlowNodes;
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
    const flowNodes: Array<Model.Base.FlowNode> =
      this.processModel.flowNodes.filter((flowNode: Model.Base.FlowNode) => {
        return flowNode instanceof type;
      });

    return flowNodes as Array<TFlowNode>;
  }
}
