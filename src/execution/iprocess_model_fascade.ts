import { Model } from '@process-engine/process_engine_contracts';

export interface IProcessModelFascade {
  getStartEvent(): Model.Events.StartEvent;
  getFlowNodeById(flowNodeId: string): Model.Base.FlowNode;
  getIncomingSequenceFlowsFor(flowNodeId: string): Array<Model.Types.SequenceFlow>;
  getOutgoingSequenceFlowsFor(flowNodeId: string): Array<Model.Types.SequenceFlow>;
  getNextFlowNodeFor(flowNode: Model.Base.FlowNode): Model.Base.FlowNode;
  getBoundaryEventsFor(flowNode: Model.Base.FlowNode): Array<Model.Events.BoundaryEvent>;
  getJoinGatewayFor(parallelGatewayNode: Model.Gateways.ParallelGateway): Model.Gateways.ParallelGateway;
  getSequenceFlowBetween(flowNode: Model.Base.FlowNode, nextFlowNode: Model.Base.FlowNode): Model.Types.SequenceFlow;
  // getSubProcessStartEvent(subProcess: Model.Activities.SubProcess): Model.Events.StartEvent;
  getSubProcessModelFascade(subProcessNode: Model.Activities.SubProcess): IProcessModelFascade;
}
