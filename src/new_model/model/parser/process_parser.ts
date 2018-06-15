
import {BpmnTags, IParsedObjectModel, Model,} from '@process-engine/process_engine_contracts';
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

    const bpmnErrors: Array<Model.Types.Error> = parseErrors(parsedObjectModel);

    process.laneSet = Parser.parseProcessLaneSet(processRaw);
    process.sequenceFlows = Parser.parseProcessSequenceFlows(processRaw);
    process.flowNodes = Parser.parseProcessFlowNodes(processRaw, bpmnErrors);


    processes.push(process);
  }

  return processes;
}

/**
 * Parse the error definitions.
 * 
 * @param parsedObjectModel Object model of the parsed xml process definition.
 * @returns a list of all parsed error events.
 */
function parseErrors(parsedObjectModel: IParsedObjectModel): Array<Model.Types.Error> {
  
  const errors: Array<Model.Types.Error> = []
  const collaborationHasNoError: boolean = !parsedObjectModel[BpmnTags.CommonElement.Error];
  
  if (collaborationHasNoError) {
    return errors;
  }

  const rawErrors: any = parsedObjectModel[BpmnTags.CommonElement.Error];

  if (Array.isArray(rawErrors)) {
    for (const rawError of rawErrors) {
      const newError: Model.Types.Error = getErrorObjectFromRawError(rawError);
      errors.push(newError);
    }
  } else {
    const newError: Model.Types.Error = getErrorObjectFromRawError(rawErrors);
    errors.push(newError);
  }

  return errors;
}

/**
 *  Creates a new error object from a parsed error object model.
 * 
 * @param rawError Raw error data from the parsed object model
 * @returns a parsed error object 
 */
function getErrorObjectFromRawError(rawError: any): Model.Types.Error {          
  const newError: Model.Types.Error = createObjectWithCommonProperties(rawError, Model.Types.Error);
    
  newError.errorCode = rawError.errorCode;
  newError.name = rawError.name;
  newError.id = rawError.id;

  return newError;
}
