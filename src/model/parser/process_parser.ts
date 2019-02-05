
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

    const bpmnErrors: Array<Model.Types.Error> = parseErrorsFromProcessModel(parsedObjectModel);
    const eventDefinitions: Array<Model.EventDefinitions.EventDefinition> = parseEventDefinitionsFromObjectModel(parsedObjectModel);

    process.laneSet = Parser.parseProcessLaneSet(processRaw);
    process.sequenceFlows = Parser.parseProcessSequenceFlows(processRaw);
    process.flowNodes = Parser.parseProcessFlowNodes(processRaw, bpmnErrors, eventDefinitions);

    processes.push(process);
  }

  return processes;
}

/**
 * Extract the error definitions from the process model.
 *
 * @param parsedObjectModel Object model of the parsed xml process definition.
 * @returns                 A list of all parsed error definitions.
 *                          Returns an empty list, if no errors are defined.
 */
function parseErrorsFromProcessModel(parsedObjectModel: IParsedObjectModel): Array<Model.Types.Error> {

  const errors: Array<Model.Types.Error> = [];
  const collaborationHasNoError: boolean = !parsedObjectModel[BpmnTags.CommonElement.Error];

  if (collaborationHasNoError) {
    return [];
  }

  const rawErrors: Array<any> = getModelPropertyAsArray(parsedObjectModel, BpmnTags.CommonElement.Error);

  for (const rawError of rawErrors) {
    const newError: Model.Types.Error = createObjectWithCommonProperties(rawError, Model.Types.Error);

    newError.code = rawError.errorCode;
    newError.name = rawError.name;
    newError.id = rawError.id;

    errors.push(newError);
  }

  return errors;
}

function parseEventDefinitionsFromObjectModel(parsedObjectModel: IParsedObjectModel): Array<Model.EventDefinitions.EventDefinition> {

  const messageDefinitions: Array<Model.EventDefinitions.MessageEventDefinition> =
  parseEventDefinitionTypeFromObjectModel(parsedObjectModel, BpmnTags.CommonElement.Message, Model.EventDefinitions.MessageEventDefinition);

  const signalDefinitions: Array<Model.EventDefinitions.MessageEventDefinition> =
  parseEventDefinitionTypeFromObjectModel(parsedObjectModel, BpmnTags.CommonElement.Signal, Model.EventDefinitions.SignalEventDefinition);

  return Array.prototype.concat(messageDefinitions, signalDefinitions);
}

function parseEventDefinitionTypeFromObjectModel<TEventDefinition>(
  parsedObjectModel: IParsedObjectModel,
  tagName: BpmnTags.CommonElement,
  typeFactory: Model.Base.IConstructor<TEventDefinition>,
): Array<TEventDefinition> {

  const eventDefinitions: Array<TEventDefinition> = [];

  const rawDefinitions: Array<any> = getModelPropertyAsArray(parsedObjectModel, tagName);

  const collaborationHasNoMatchingDefinitions: boolean = !rawDefinitions || rawDefinitions.length === 0;
  if (collaborationHasNoMatchingDefinitions) {
    return eventDefinitions;
  }

  for (const rawDefinition of rawDefinitions) {
    const newDefinition: TEventDefinition = new typeFactory();

    (newDefinition as any).id = rawDefinition.id;
    (newDefinition as any).name = rawDefinition.name;

    eventDefinitions.push(newDefinition);
  }

  return eventDefinitions;

}
