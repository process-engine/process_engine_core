
import {BpmnTags, IParsedObjectModel, Model} from '@process-engine/process_engine_contracts';
import {
  createObjectWithCommonProperties,
  getModelPropertyAsArray,
} from './../type_factory';
import * as Parser from './index';

export function parseProcesses(parsedObjectModel: IParsedObjectModel): Array<Model.Types.Process> {

  // NOTE: See above, this can be an Object or an Array.
  const processData: Array<any> = getModelPropertyAsArray(parsedObjectModel, BpmnTags.CommonElement.Process);

  const processes: Array<Model.Types.Process> = [];

  for (const processRaw of processData) {

    const process: Model.Types.Process = createObjectWithCommonProperties(processRaw, Model.Types.Process);

    process.name = processRaw.name;
    process.isExecutable = processRaw.isExecutable === 'true' ? true : false;

    process.laneSet = Parser.parseProcessLaneSet(processRaw);
    process.sequenceFlows = parseProcessSequenceFlows(processRaw);
    process.flowNodes = parseProcessFlowNodes(processRaw);

    processes.push(process);
  }

  return processes;
}

// TODO: The following elements are not supported yet:
// - Text annotations
// - Associations
// - Intermediate Catch- & Throw- Events of any kind
// - Subprocess
export function parseProcessFlowNodes(processData: any): Array<Model.Base.FlowNode> {

  let nodes: Array<Model.Base.FlowNode> = [];

  const events: Array<Model.Events.Event> = Parser.parseEventsFromProcessData(processData);
  const gateways: Array<Model.Gateways.Gateway> = Parser.parseGatewaysFromProcessData(processData);
  const tasks: Array<Model.Activities.Activity> = Parser.parseActivitiesFromProcessData(processData);

  nodes = nodes.concat(gateways, tasks, events);

  return nodes;
}

export function parseProcessSequenceFlows(data: any): Array<Model.Types.SequenceFlow> {

  // NOTE: See above, this can be an Object or an Array (Admittedly, the first is somewhat unlikely here, but not impossible).
  const sequenceData: Array<any> = getModelPropertyAsArray(data, BpmnTags.OtherElements.SequenceFlow);

  const sequences: Array<Model.Types.SequenceFlow> = [];

  for (const sequenceRaw of sequenceData) {

    const sequenceFlow: Model.Types.SequenceFlow = createObjectWithCommonProperties(sequenceRaw, Model.Types.SequenceFlow);

    sequenceFlow.name = sequenceRaw.name;
    sequenceFlow.sourceRef = sequenceRaw.sourceRef;
    sequenceFlow.targetRef = sequenceRaw.targetRef;

    if (sequenceRaw[BpmnTags.FlowElementProperty.ConditionExpression]) {
      const conditionData: any = sequenceRaw[BpmnTags.FlowElementProperty.ConditionExpression];

      sequenceFlow.conditionExpression = {
        type: conditionData[BpmnTags.FlowElementProperty.XsiType],
        expression: conditionData._,
      };
    }

    sequences.push(sequenceFlow);
  }

  return sequences;
}
