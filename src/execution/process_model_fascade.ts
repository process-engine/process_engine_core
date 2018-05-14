import { Model, Runtime } from '@process-engine/process_engine_contracts';

export interface IPredicate<T> {
  (item: T): boolean;
}

export interface IProcessModelFascade {
  getStartEvent(): Model.Events.StartEvent;
  getFlowNodeById(flowNodeId: string): Model.Base.FlowNode;
  getIncomingSequenceFlowsFor(flowNodeId: string): Array<Model.Types.SequenceFlow>;
  getOutgoingSequenceFlowsFor(flowNodeId: string): Array<Model.Types.SequenceFlow>;
  getNextFlowNodeFor(flowNode: Model.Base.FlowNode): Model.Base.FlowNode;
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