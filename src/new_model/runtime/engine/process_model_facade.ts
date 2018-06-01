import { BpmnType, IProcessModelFacade, Model } from '@process-engine/process_engine_contracts';
import { SubProcessModelFacade } from './index';

export class ProcessModelFacade implements IProcessModelFacade {

  private _processDefinition: Model.Types.Process;

  constructor(processDefinition: Model.Types.Process) {
    this._processDefinition = processDefinition;
  }

  protected get processDefinition(): Model.Types.Process {
    return this._processDefinition;
  }

  public getSequenceFlowBetween(flowNode: Model.Base.FlowNode, nextFlowNode: Model.Base.FlowNode): Model.Types.SequenceFlow {

    if (!nextFlowNode) {
      return undefined;
    }

    const sequenceFlowsTargetingNextFlowNode: Array<Model.Types.SequenceFlow>
      = this.processDefinition.sequenceFlows.filter((sequenceFlow: Model.Types.SequenceFlow) => {
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

  public getSubProcessModelFacade(subProcessNode: Model.Activities.SubProcess): IProcessModelFacade {
    return new SubProcessModelFacade(this.processDefinition, subProcessNode);
  }

  // TODO: implement execution of specific StartEvent
  public getStartEvent(): Model.Events.StartEvent {

    const startEventDef: Model.Base.FlowNode = this.processDefinition.flowNodes.find((flowNode: Model.Base.FlowNode) => {
      return flowNode.constructor.name === 'StartEvent';
    });

    return startEventDef as Model.Events.StartEvent;
  }

  public getIncomingSequenceFlowsFor(flowNodeId: string): Array<Model.Types.SequenceFlow> {
    return this.processDefinition.sequenceFlows.filter((sequenceFlow: Model.Types.SequenceFlow) => {
      return sequenceFlow.targetRef === flowNodeId;
    });
  }

  public getOutgoingSequenceFlowsFor(flowNodeId: string): Array<Model.Types.SequenceFlow> {
    return this.processDefinition.sequenceFlows.filter((sequenceFlow: Model.Types.SequenceFlow) => {
      return sequenceFlow.sourceRef === flowNodeId;
    });
  }

  // TODO: support of new Split Gateway in Branch
  public getJoinGatewayFor(parallelGatewayNode: Model.Gateways.ParallelGateway): Model.Gateways.ParallelGateway {

    const incomingSequenceFlows: Array<Model.Types.SequenceFlow> = this.getIncomingSequenceFlowsFor(parallelGatewayNode.id);
    const outgoingSequenceFlows: Array<Model.Types.SequenceFlow> = this.getOutgoingSequenceFlowsFor(parallelGatewayNode.id);

    const flowNodeIsParallelGateway: boolean = parallelGatewayNode.bpmnType === BpmnType.parallelGateway;
    const flowNodeIsJoinGateway: boolean = incomingSequenceFlows.length > outgoingSequenceFlows.length;

    if (flowNodeIsParallelGateway && flowNodeIsJoinGateway) {
      return parallelGatewayNode;
    }

    const nextFlowNode: Model.Base.FlowNode = this.getNextFlowNodeFor(parallelGatewayNode);

    return this.getJoinGatewayFor(nextFlowNode as Model.Gateways.ParallelGateway);
  }

  public getBoundaryEventsFor(flowNode: Model.Base.FlowNode): Array<Model.Events.BoundaryEvent> {
    const boundaryEvents: Array<Model.Base.FlowNode> = this.processDefinition.flowNodes.filter((currentFlowNode: Model.Base.FlowNode) => {

      const isBoundaryEvent: boolean = currentFlowNode.bpmnType === BpmnType.boundaryEvent;
      const boundaryEventIsAttachedToFlowNode: boolean = (currentFlowNode as Model.Events.BoundaryEvent).attachedToRef === flowNode.id;

      return isBoundaryEvent && boundaryEventIsAttachedToFlowNode;
    });

    return boundaryEvents as Array<Model.Events.BoundaryEvent>;
  }

  public getNextFlowNodeFor(flowNode: Model.Base.FlowNode): Model.Base.FlowNode {

    // First find the SequenceFlow that describes the next target after the FlowNode

    const flow: Model.Types.SequenceFlow = this.processDefinition.sequenceFlows.find((sequenceFlow: Model.Types.SequenceFlow) => {
      return sequenceFlow.sourceRef === flowNode.id;
    });

    if (!flow) {
      return null;
    }

    // Then find the target FlowNode of the SequenceFlow

    const nextFlowNode: Model.Base.FlowNode = this.processDefinition.flowNodes.find((currentFlowNode: Model.Base.FlowNode) => {
      return currentFlowNode.id === flow.targetRef;
    });

    return nextFlowNode;
  }

  public getFlowNodeById(flowNodeId: string): Model.Base.FlowNode {
    const nextFlowNode: Model.Base.FlowNode = this.processDefinition.flowNodes.find((currentFlowNode: Model.Base.FlowNode) => {
        return currentFlowNode.id === flowNodeId;
    });

    return nextFlowNode;
  }
}