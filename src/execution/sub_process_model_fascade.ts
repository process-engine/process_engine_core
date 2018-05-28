import { Model } from '@process-engine/process_engine_contracts';
import { IProcessModelFascade } from './iprocess_model_fascade';
import { ProcessModelFascade } from './process_model_fascade';

export class SubProcessModelFascade extends ProcessModelFascade implements IProcessModelFascade {

  private _subProcessDefinition: Model.Activities.SubProcess;

  constructor(processDefinition: Model.Types.Process, subProcessDefinition: Model.Activities.SubProcess) {
    super(processDefinition);
    this._subProcessDefinition = subProcessDefinition;
  }

  private get subProcessDefinition(): Model.Activities.SubProcess {
    return this._subProcessDefinition;
  }

  public getStartEvent(): Model.Events.StartEvent {

    const startEventDef: Model.Base.FlowNode = this.subProcessDefinition.flowNodes.find((flowNode: Model.Base.FlowNode) => {
      return flowNode.constructor.name === 'StartEvent';
    });

    return startEventDef as Model.Events.StartEvent;
  }

  public getNextFlowNodeFor(flowNode: Model.Base.FlowNode): Model.Base.FlowNode {

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
