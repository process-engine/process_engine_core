import {BpmnType, IProcessModelFacade, Model} from '@process-engine/process_engine_contracts';

import {SubProcessModelFacade} from './index';

export class ProcessModelFacade implements IProcessModelFacade {

  private _processModel: Model.Types.Process;

  constructor(processModel: Model.Types.Process) {
    this._processModel = processModel;
  }

  protected get processModel(): Model.Types.Process {
    return this._processModel;
  }

  public getIsExecutable(): boolean {
    return this.processModel.isExecutable;
  }

  public getSequenceFlowBetween(flowNode: Model.Base.FlowNode, nextFlowNode: Model.Base.FlowNode): Model.Types.SequenceFlow {

    if (!nextFlowNode) {
      return undefined;
    }

    const sequenceFlowsTargetingNextFlowNode: Array<Model.Types.SequenceFlow> =
      this.processModel.sequenceFlows.filter((sequenceFlow: Model.Types.SequenceFlow) => {
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

  public getStartEvents(): Array<Model.Events.StartEvent> {

    const startEvents: Array<Model.Base.FlowNode> = this.processModel.flowNodes.filter((flowNode: Model.Base.FlowNode) => {
      return flowNode instanceof Model.Events.StartEvent;
    });

    return startEvents as Array<Model.Events.StartEvent>;
  }

  public getStartEventById(startEventId: string): Model.Events.StartEvent {

    const startEvents: Array<Model.Events.StartEvent> = this.getStartEvents();

    // TODO:
    // For backwards compatibility only.
    // This allows the old process engine service to use the new object model.
    //
    // Note that is not the desired default behavior.
    // Aside from the ProcessEngineService, no component should ever pass an empty start event to the executeProcessService!
    //
    // In future versions, passing an empty start event id should result in an error!
    if (!startEventId) {
      return startEvents[0];
    }

    const matchingStartEvent: Model.Events.StartEvent = startEvents.find((startEvent: Model.Events.StartEvent): boolean => {
      return startEvent.id === startEventId;
    });

    if (!matchingStartEvent) {
      throw new Error(`Start event with id '${startEventId}' not found!`);
    }

    return matchingStartEvent;
  }

  public getEndEvents(): Array<Model.Events.EndEvent> {

    const endEvents: Array<Model.Base.FlowNode> = this.processModel.flowNodes.filter((flowNode: Model.Base.FlowNode) => {
      return flowNode instanceof Model.Events.EndEvent;
    });

    return endEvents as Array<Model.Events.EndEvent>;
  }

  // TODO (SM): this is a duplicate from the process engine adapter (consumer_api_core)
  public getUserTasks(): Array<Model.Activities.UserTask> {

    const userTaskFlowNodes: Array<Model.Base.FlowNode> = this.processModel.flowNodes.filter((flowNode: Model.Base.FlowNode) => {
      return flowNode instanceof Model.Activities.UserTask;
    });

    const laneUserTasks: Array<Model.Activities.UserTask> = this._getUserTasksFromFlowNodeList(this.processModel);

    return [
      ...userTaskFlowNodes,
      ...laneUserTasks,
    ] as Array<Model.Activities.UserTask>;
  }

  private _getUserTasksFromFlowNodeList(processModel: Model.Types.Process): Array<Model.Activities.UserTask> {

    if (!processModel.laneSet) {
      return [];
    }

    const userTasks: Array<Model.Base.FlowNode> = processModel.flowNodes.filter((flowNode: Model.Base.FlowNode) => {
      return flowNode instanceof Model.Activities.UserTask;
    });

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

    const nextFlowNode: Model.Base.FlowNode = this.getNextFlowNodeFor(parallelGatewayNode);

    const flowNodeIsParallelGateway: boolean = parallelGatewayNode.bpmnType === BpmnType.parallelGateway;

    if (!flowNodeIsParallelGateway) {
      return this.getJoinGatewayFor(nextFlowNode as Model.Gateways.ParallelGateway);
    }

    const flowNodeIsJoinGateway: boolean = parallelGatewayNode.gatewayDirection !== Model.Gateways.GatewayDirection.Diverging;

    if (flowNodeIsParallelGateway && flowNodeIsJoinGateway) {
      return parallelGatewayNode;
    }

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
