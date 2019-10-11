import {Model} from '@process-engine/persistence_api.contracts';
import {IProcessModelFacade} from '@process-engine/process_engine_contracts';

export class ProcessModelFacadeMock implements IProcessModelFacade {

  public getIsExecutable(): boolean {
    return false;
  }

  public getSubProcessModelFacade(subProcessNode: Model.Activities.SubProcess): IProcessModelFacade {
    return {} as any;
  }

  public getStartEvents(): Array<Model.Events.StartEvent> {
    return [];
  }

  public getSingleStartEvent(): Model.Events.StartEvent {
    return {} as any;
  }

  public getStartEventById(startEventId: string): Model.Events.StartEvent {
    return {} as any;
  }

  public getEndEvents(): Array<Model.Events.EndEvent> {
    return [];
  }

  public getUserTasks(): Array<Model.Activities.UserTask> {
    return [];
  }

  public getFlowNodeById(flowNodeId: string): Model.Base.FlowNode {
    return {} as any;
  }

  public getProcessModelHasLanes(): boolean {
    return false;
  }

  public getLaneForFlowNode(flowNodeId: string): Model.ProcessElements.Lane {
    return {} as any;
  }

  public getIncomingSequenceFlowsFor(flowNodeId: string): Array<Model.ProcessElements.SequenceFlow> {
    return [];
  }

  public getOutgoingSequenceFlowsFor(flowNodeId: string): Array<Model.ProcessElements.SequenceFlow> {
    return {} as any;
  }

  public getSequenceFlowBetween(sourceNode: Model.Base.FlowNode, targetNode: Model.Base.FlowNode): Model.ProcessElements.SequenceFlow {
    return {} as any;
  }

  public getBoundaryEventsFor(flowNode: Model.Base.FlowNode): Array<Model.Events.BoundaryEvent> {
    return [];
  }

  public getPreviousFlowNodesFor(flowNode: Model.Base.FlowNode): Array<Model.Base.FlowNode> {
    return [];
  }

  public getNextFlowNodesFor(flowNode: Model.Base.FlowNode): Array<Model.Base.FlowNode> {
    return [];
  }

  public getLinkCatchEventsByLinkName(linkName: string): Array<Model.Events.IntermediateCatchEvent> {
    return [];
  }

}
