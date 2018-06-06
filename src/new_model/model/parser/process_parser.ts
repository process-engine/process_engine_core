
import {BpmnTags, IParsedObjectModel, Model} from '@process-engine/process_engine_contracts';
import {
  createObjectWithCommonProperties,
  getModelPropertyAsArray,
} from './../type_factory';
import * as Parser from './index';

export function parseProcesses(parsedObjectModel: IParsedObjectModel): Array<Model.Types.Process> {

  const processData: Array<any> = getModelPropertyAsArray(parsedObjectModel, BpmnTags.CommonElement.Process);

  const processes: Array<Model.Types.Process> = [];

  for (const processRaw of processData) {

    const process: Model.Types.Process = createObjectWithCommonProperties(processRaw, Model.Types.Process);

    process.name = processRaw.name;
    process.isExecutable = processRaw.isExecutable === 'true' ? true : false;

    process.laneSet = Parser.parseProcessLaneSet(processRaw);
    process.sequenceFlows = Parser.parseProcessSequenceFlows(processRaw);
    process.flowNodes = Parser.parseProcessFlowNodes(processRaw);

    processes.push(process);
  }

  return processes;
}
