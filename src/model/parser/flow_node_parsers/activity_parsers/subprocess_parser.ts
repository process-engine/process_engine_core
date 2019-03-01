import {BpmnTags, Model} from '@process-engine/process_model.contracts';

import {getModelPropertyAsArray} from '../../../type_factory';
import {createActivityInstance} from './activity_factory';

import {parseProcessFlowNodes} from '../../flow_node_parser';
import {parseProcessLaneSet} from '../../process_lane_set_parser';
import {parseProcessSequenceFlows} from '../../sequence_flow_parser';

export function parseSubProcesses(
  processData: any,
  errors: Array<Model.GlobalElements.Error>,
  eventDefinitions: Array<Model.Events.Definitions.EventDefinition>,
): Array<Model.Activities.SubProcess> {

  const subProcesses: Array<Model.Activities.SubProcess> = [];

  const subProcessesRaw: Array<any> = getModelPropertyAsArray(processData, BpmnTags.TaskElement.SubProcess);

  const noSubProcessesFound: boolean = !subProcessesRaw || subProcessesRaw.length === 0;
  if (noSubProcessesFound) {
    return [];
  }

  for (const subProcessRaw of subProcessesRaw) {
    const subProcess: Model.Activities.SubProcess = createActivityInstance(subProcessRaw, Model.Activities.SubProcess);

    subProcess.laneSet = parseProcessLaneSet(subProcessRaw);
    subProcess.flowNodes = parseProcessFlowNodes(subProcessRaw, errors, eventDefinitions);
    subProcess.sequenceFlows = parseProcessSequenceFlows(subProcessRaw);

    subProcesses.push(subProcess);
  }

  return subProcesses;
}
