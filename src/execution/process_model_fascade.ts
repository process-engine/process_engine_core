import { Model, Runtime, BpmnType } from '@process-engine/process_engine_contracts';

export interface IPredicate<T> {
  (item: T): boolean;
}

export interface IProcessModelFascade {
  getStartEvent(): Model.Events.StartEvent;
  getFlowNodeById(flowNodeId: string): Model.Base.FlowNode;
  getIncomingSequenceFlowsFor(flowNodeId: string): Array<Model.Types.SequenceFlow>;
  getOutgoingSequenceFlowsFor(flowNodeId: string): Array<Model.Types.SequenceFlow>;
  getNextFlowNodeFor(flowNode: Model.Base.FlowNode): Model.Base.FlowNode;
  getBoundaryEventsFor(flowNode: Model.Base.FlowNode): Array<Model.Events.BoundaryEvent>;
  getJoinGatewayFor(parallelGatewayNode: Model.Gateways.ParallelGateway): Model.Gateways.ParallelGateway;
} 

export class ProcessModelFascade implements IProcessModelFascade {

  private processDefinition: Model.Types.Process;

  constructor(processDefinition: Model.Types.Process) {
    this.processDefinition = processDefinition;
  }

  public getStartEvent(): Model.Events.StartEvent {

    const startEventDef: Model.Base.FlowNode = this.processDefinition.flowNodes.find((nodeDef: Model.Base.FlowNode) => {
      return nodeDef.constructor.name === 'StartEvent';
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
    
    const isFlowNodeParallelGateway: boolean = parallelGatewayNode.bpmnType === BpmnType.parallelGateway;

    if (isFlowNodeParallelGateway && incomingSequenceFlows.length > outgoingSequenceFlows.length) {
      return parallelGatewayNode;
    } else {
      const nextFlowNode: Model.Base.FlowNode = this.getNextFlowNodeFor(parallelGatewayNode);
      return this.getJoinGatewayFor(nextFlowNode as Model.Gateways.ParallelGateway);
    }
  }

  public getBoundaryEventsFor(flowNode: Model.Base.FlowNode): Array<Model.Events.BoundaryEvent> {
    const boundaryEvents: Array<Model.Base.FlowNode> = this.processDefinition.flowNodes.filter((currentFlowNode: Model.Base.FlowNode) => {
      return currentFlowNode.bpmnType === BpmnType.boundaryEvent
        && (currentFlowNode as Model.Events.BoundaryEvent).attachedToRef === flowNode.id;
    });

    return boundaryEvents as Array<Model.Events.BoundaryEvent>;
  }

  public getNextFlowNodeFor(flowNode: Model.Base.FlowNode): Model.Base.FlowNode {
    
    const flow: Model.Types.SequenceFlow = this.processDefinition.sequenceFlows.find((sequenceFlow: Model.Types.SequenceFlow) => {
      return sequenceFlow.sourceRef === flowNode.id;
    });

    if (!flow) {
      return null;
    } 

    const nextFlowNode: Model.Base.FlowNode = this.processDefinition.flowNodes.find((flowNode: Model.Base.FlowNode) => {
      return flowNode.id === flow.targetRef;
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