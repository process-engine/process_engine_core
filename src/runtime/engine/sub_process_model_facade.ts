import {InternalServerError} from '@essential-projects/errors_ts';
import {BpmnType, Model} from '@process-engine/process_engine_contracts';
import {ProcessModelFacade} from './process_model_facade';

export class SubProcessModelFacade extends ProcessModelFacade {

  private _subProcessDefinition: Model.Activities.SubProcess;

  constructor(processDefinition: Model.Types.Process, subProcessDefinition: Model.Activities.SubProcess) {
    super(processDefinition);
    this._subProcessDefinition = subProcessDefinition;
  }

  private get subProcessDefinition(): Model.Activities.SubProcess {
    return this._subProcessDefinition;
  }

  public getStartEvents(): Array<Model.Events.StartEvent> {

    // The SubProcess-StartEvent is not contained in the processDefinition, but in the subProcessDefinition

    const startEventDef: Array<Model.Base.FlowNode> = this.subProcessDefinition.flowNodes.filter((flowNode: Model.Base.FlowNode) => {
      return flowNode instanceof Model.Events.StartEvent;
    });

    return startEventDef as Array<Model.Events.StartEvent>;
  }

  public getPreviousFlowNodesFor(flowNode: Model.Base.FlowNode): Array<Model.Base.FlowNode> {

    // First find the SequenceFlows that contain the FlowNodes next targets
    const sequenceFlows: Array<Model.Types.SequenceFlow> =
      this.subProcessDefinition.sequenceFlows.filter((sequenceFlow: Model.Types.SequenceFlow) => {
        return sequenceFlow.targetRef === flowNode.id;
      });

    const flowhasNoSource: boolean = !sequenceFlows || sequenceFlows.length === 0;
    if (flowhasNoSource) {
      return undefined;
    }

    // Then find the source FlowNodes for each SequenceFlow
    const previousFlowNodes: Array<Model.Base.FlowNode> =
      sequenceFlows.map((currentSequenceFlow: Model.Types.SequenceFlow) => {

        const sourceNode: Model.Base.FlowNode =
          this.subProcessDefinition.flowNodes.find((currentFlowNode: Model.Base.FlowNode) => currentFlowNode.id === currentSequenceFlow.sourceRef);

        // If the sourceNode happens to be a BoundaryEvent, return the Node that the BoundaryEvent is attached to.
        const sourceNodeIsBoundaryEvent: boolean = sourceNode.bpmnType === BpmnType.boundaryEvent;
        if (sourceNodeIsBoundaryEvent) {
          return this.subProcessDefinition.flowNodes.find((currentFlowNode: Model.Base.FlowNode) => {
            return currentFlowNode.id === (sourceNode as Model.Events.BoundaryEvent).attachedToRef;
          });
        }

        return sourceNode;
      });

    return previousFlowNodes;
  }

  public getNextFlowNodesFor(flowNode: Model.Base.FlowNode): Array<Model.Base.FlowNode> {

    // First find the SequenceFlows that contain the FlowNodes next targets
    const sequenceFlows: Array<Model.Types.SequenceFlow> =
      this.subProcessDefinition.sequenceFlows.filter((sequenceFlow: Model.Types.SequenceFlow) => {
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
      sequenceFlows.map((sequenceFlow: Model.Types.SequenceFlow) => {
        return this.subProcessDefinition.flowNodes.find((node: Model.Base.FlowNode) => node.id === sequenceFlow.targetRef);
      });

    return nextFlowNodes;
  }

}
