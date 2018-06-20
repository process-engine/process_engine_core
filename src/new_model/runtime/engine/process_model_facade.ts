import { BpmnType, IProcessModelFacade, Model } from '@process-engine/process_engine_contracts';
import { SubProcessModelFacade } from './index';

export class ProcessModelFacade implements IProcessModelFacade {

  private _processModel: Model.Types.Process;

  constructor(processModel: Model.Types.Process) {
    this._processModel = processModel;
  }

  protected get processModel(): Model.Types.Process {
    return this._processModel;
  }

  public getSequenceFlowBetween(flowNode: Model.Base.FlowNode, nextFlowNode: Model.Base.FlowNode): Model.Types.SequenceFlow {

    if (!nextFlowNode) {
      return undefined;
    }

    const sequenceFlowsTargetingNextFlowNode: Array<Model.Types.SequenceFlow>
      = this.processModel.sequenceFlows.filter((sequenceFlow: Model.Types.SequenceFlow) => {
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
    return new SubProcessModelFacade(this.processModel, subProcessNode);
  }

  // TODO: implement execution of specific StartEvent
  public getStartEvent(): Model.Events.StartEvent {

    const startEvent: Model.Base.FlowNode = this.processModel.flowNodes.find((flowNode: Model.Base.FlowNode) => {
      return flowNode instanceof Model.Events.StartEvent;
    });

    return startEvent as Model.Events.StartEvent;
  }

  public getEndEvents(): Array<Model.Events.EndEvent> {

    const endEvent: Array<Model.Base.FlowNode> = this.processModel.flowNodes.filter((flowNode: Model.Base.FlowNode) => {
      return flowNode instanceof Model.Events.EndEvent;
    });

    return endEvent as Array<Model.Events.EndEvent>;
  }

  // TODO (SM): this is a duplicate from the process engine adapter (consumer_api_core)
  public getUserTasks(): Array<Model.Activities.UserTask> {

    const userTaskFlowNodes: Array<Model.Base.FlowNode> = this.processModel.flowNodes.filter((flowNode: Model.Base.FlowNode) => {
      return flowNode instanceof Model.Activities.UserTask;
    });

    const laneUserTasks: Array<Model.Activities.UserTask> = this._getUserTasksFromLaneRecursively(this.processModel.laneSet);

    return [
      ...userTaskFlowNodes,
      ...laneUserTasks,
    ] as Array<Model.Activities.UserTask>;
  }

  private _getUserTasksFromLaneRecursively(laneSet: Model.Types.LaneSet): Array<Model.Activities.UserTask> {

    const userTasks: Array<Model.Base.FlowNode> = [];

    if (!laneSet) {
      return userTasks as Array<Model.Activities.UserTask>;
    }

    for (const lane of laneSet.lanes) {

      const userTaskFlowNodes: Array<Model.Base.FlowNode> = lane.flowNodeReferences.filter((flowNode: Model.Base.FlowNode) => {
        return flowNode instanceof Model.Activities.UserTask;
      });

      Array.prototype.push.apply(userTasks, userTaskFlowNodes);

      const childUserTasks: Array<Model.Activities.UserTask> = this._getUserTasksFromLaneRecursively(lane.childLaneSet);
      Array.prototype.push.apply(userTasks, childUserTasks);
    }

    return userTasks as Array<Model.Activities.UserTask>;
  }

  public getIncomingSequenceFlowsFor(flowNodeId: string): Array<Model.Types.SequenceFlow> {
    return this.processModel.sequenceFlows.filter((sequenceFlow: Model.Types.SequenceFlow) => {
      return sequenceFlow.targetRef === flowNodeId;
    });
  }

  public getOutgoingSequenceFlowsFor(flowNodeId: string): Array<Model.Types.SequenceFlow> {
    return this.processModel.sequenceFlows.filter((sequenceFlow: Model.Types.SequenceFlow) => {
      return sequenceFlow.sourceRef === flowNodeId;
    });
  }

  // TODO: support of new Split Gateway in Branch
  //       currently the next Parallel Gateway is always taken as the Parallel Join Gateway
  //       we still need an integration test with multiple parallel branches to fully implement this
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
    const boundaryEvents: Array<Model.Base.FlowNode> = this.processModel.flowNodes.filter((currentFlowNode: Model.Base.FlowNode) => {

      const isBoundaryEvent: boolean = currentFlowNode.bpmnType === BpmnType.boundaryEvent;
      const boundaryEventIsAttachedToFlowNode: boolean = (currentFlowNode as Model.Events.BoundaryEvent).attachedToRef === flowNode.id;

      return isBoundaryEvent && boundaryEventIsAttachedToFlowNode;
    });

    return boundaryEvents as Array<Model.Events.BoundaryEvent>;
  }

  public getNextFlowNodeFor(flowNode: Model.Base.FlowNode): Model.Base.FlowNode {

    // First find the SequenceFlow that describes the next target after the FlowNode

    const flow: Model.Types.SequenceFlow = this.processModel.sequenceFlows.find((sequenceFlow: Model.Types.SequenceFlow) => {
      return sequenceFlow.sourceRef === flowNode.id;
    });

    if (!flow) {
      return null;
    }

    // Then find the target FlowNode of the SequenceFlow

    const nextFlowNode: Model.Base.FlowNode = this.processModel.flowNodes.find((currentFlowNode: Model.Base.FlowNode) => {
      return currentFlowNode.id === flow.targetRef;
    });

    return nextFlowNode;
  }

  public getFlowNodeById(flowNodeId: string): Model.Base.FlowNode {
    const nextFlowNode: Model.Base.FlowNode = this.processModel.flowNodes.find((currentFlowNode: Model.Base.FlowNode) => {
        return currentFlowNode.id === flowNodeId;
    });

    return nextFlowNode;
  }
}
