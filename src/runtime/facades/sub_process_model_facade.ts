import {InternalServerError} from '@essential-projects/errors_ts';
import {BpmnType, Model} from '@process-engine/process_model.contracts';

import {ProcessModelFacade} from './process_model_facade';

export class SubProcessModelFacade extends ProcessModelFacade {

  private subProcessDefinition: Model.Activities.SubProcess;

  constructor(processDefinition: Model.Process, subProcessDefinition: Model.Activities.SubProcess) {
    super(processDefinition);
    this.subProcessDefinition = subProcessDefinition;
  }

  public getStartEvents(): Array<Model.Events.StartEvent> {

    // The SubProcess-StartEvent is not contained in the processDefinition, but in the subProcessDefinition
    const startEventDef = this.subProcessDefinition.flowNodes.filter((flowNode: Model.Base.FlowNode): boolean => {
      return flowNode instanceof Model.Events.StartEvent;
    });

    return startEventDef as Array<Model.Events.StartEvent>;
  }

  public getPreviousFlowNodesFor(flowNode: Model.Base.FlowNode): Array<Model.Base.FlowNode> {

    // First find the SequenceFlows that contain the FlowNodes next targets
    const sequenceFlows = this.subProcessDefinition.sequenceFlows.filter((sequenceFlow: Model.ProcessElements.SequenceFlow): boolean => {
      return sequenceFlow.targetRef === flowNode.id;
    });

    const flowhasNoSource = !sequenceFlows || sequenceFlows.length === 0;
    if (flowhasNoSource) {
      return undefined;
    }

    // Then find the source FlowNodes for each SequenceFlow
    const previousFlowNodes = sequenceFlows.map((currentSequenceFlow: Model.ProcessElements.SequenceFlow): Model.Base.FlowNode => {

      const sourceNode = this.subProcessDefinition
        .flowNodes
        .find((currentFlowNode: Model.Base.FlowNode): boolean => currentFlowNode.id === currentSequenceFlow.sourceRef);

      // If the sourceNode happens to be a BoundaryEvent, return the Node that the BoundaryEvent is attached to.
      const sourceNodeIsBoundaryEvent = sourceNode.bpmnType === BpmnType.boundaryEvent;
      if (sourceNodeIsBoundaryEvent) {
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
    const nextFlowNodes = sequenceFlows.map((sequenceFlow: Model.ProcessElements.SequenceFlow): Model.Base.FlowNode => {
      return this.subProcessDefinition
        .flowNodes
        .find((node: Model.Base.FlowNode): boolean => { return node.id === sequenceFlow.targetRef; });
    });

    return nextFlowNodes;
  }

}
