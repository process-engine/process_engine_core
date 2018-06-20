import { IProcessModelFacade, Model } from '@process-engine/process_engine_contracts';
import { ProcessModelFacade } from './process_model_facade';

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

  public getNextFlowNodeFor(flowNode: Model.Base.FlowNode): Model.Base.FlowNode {

    // The FlowNodes of the SubProcess are not contained in the processDefinition, but in the subProcessDefinition

    const flow: Model.Types.SequenceFlow = this.subProcessDefinition.sequenceFlows.find((sequenceFlow: Model.Types.SequenceFlow) => {
      return sequenceFlow.sourceRef === flowNode.id;
    });

    if (!flow) {
      return null;
    }

    const nextFlowNode: Model.Base.FlowNode = this.subProcessDefinition.flowNodes.find((currentFlowNode: Model.Base.FlowNode) => {
      return currentFlowNode.id === flow.targetRef;
    });

    return nextFlowNode;
  }

}
