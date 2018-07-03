
import {
  BpmnTags,
  IParsedObjectModel,
  Model,
} from '@process-engine/process_engine_contracts';

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

    const bpmnErrors: Array<Model.Types.Error> = ExtractErrorsFromObjectModel(parsedObjectModel);

    process.laneSet = Parser.parseProcessLaneSet(processRaw);
    process.sequenceFlows = Parser.parseProcessSequenceFlows(processRaw);
    process.flowNodes = Parser.parseProcessFlowNodes(processRaw, bpmnErrors);

    processes.push(process);
  }

  return processes;
}

/**
 * Extract the error definitions from the process model.
 *
 * @param parsedObjectModel Object model of the parsed xml process definition.
 * @returns A list of all parsed error definitions; an empty list is returned, if no errors are present.
 */
function ExtractErrorsFromObjectModel(parsedObjectModel: IParsedObjectModel): Array<Model.Types.Error> {

  const errors: Array<Model.Types.Error> = [];
  const collaborationHasNoError: boolean = !parsedObjectModel[BpmnTags.CommonElement.Error];

  if (collaborationHasNoError) {
    return [];
  }

  const rawErrors: Array<any> = getModelPropertyAsArray(parsedObjectModel, BpmnTags.CommonElement.Error);

  for (const rawError of rawErrors) {
    const newError: Model.Types.Error = createObjectWithCommonProperties(rawError, Model.Types.Error);

    newError.errorCode = rawError.errorCode;
    newError.name = rawError.name;
    newError.id = rawError.id;

    errors.push(newError);
  }

  return errors;
}
