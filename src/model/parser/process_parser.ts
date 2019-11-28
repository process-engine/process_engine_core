import {BpmnTags, Model} from '@process-engine/persistence_api.contracts';

import {createObjectWithCommonProperties, getModelPropertyAsArray} from '../type_factory';

import {parseProcessFlowNodes, parseProcessLaneSet, parseProcessSequenceFlows} from './index';

export function parseProcesses(rawProcessDefinition: object): Array<Model.Process> {

  const rawProcesses = getModelPropertyAsArray(rawProcessDefinition, BpmnTags.CommonElement.Process);

  if (!rawProcesses) {
    return [];
  }

  const processes: Array<Model.Process> = [];

  for (const rawProcess of rawProcesses) {

    const process = createObjectWithCommonProperties(rawProcess, Model.Process);

    process.name = rawProcess.name;
    process.isExecutable = rawProcess.isExecutable === 'true';

    const bpmnErrors = parseProcessModelErrors(rawProcessDefinition);
    const eventDefinitions = parseEventDefinitionsFromObjectModel(rawProcessDefinition);

    process.laneSet = parseProcessLaneSet(rawProcess);
    process.sequenceFlows = parseProcessSequenceFlows(rawProcess);
    process.flowNodes = parseProcessFlowNodes(rawProcess, bpmnErrors, eventDefinitions);

    processes.push(process);
  }

  return processes;
}

function parseProcessModelErrors(rawProcessDefinition: object): Array<Model.GlobalElements.Error> {

  const processHasNoErrors = !rawProcessDefinition[BpmnTags.CommonElement.Error];
  if (processHasNoErrors) {
    return [];
  }

  const rawErrors = getModelPropertyAsArray(rawProcessDefinition, BpmnTags.CommonElement.Error);

  const errors: Array<Model.GlobalElements.Error> = [];

  for (const rawError of rawErrors) {
    const newError = createObjectWithCommonProperties(rawError, Model.GlobalElements.Error);

    newError.id = rawError.id;
    newError.code = rawError.errorCode;
    newError.name = rawError.name;
    newError.message = rawError.message;

    errors.push(newError);
  }

  return errors;
}

function parseEventDefinitionsFromObjectModel(rawProcessDefinition: object): Array<Model.Events.Definitions.EventDefinition> {

  const messageDefinitions =
    parseEventDefinitionTypeFromObjectModel(rawProcessDefinition, BpmnTags.CommonElement.Message, Model.Events.Definitions.MessageEventDefinition);

  const signalDefinitions =
    parseEventDefinitionTypeFromObjectModel(rawProcessDefinition, BpmnTags.CommonElement.Signal, Model.Events.Definitions.SignalEventDefinition);

  return Array.prototype.concat(messageDefinitions, signalDefinitions);
}

function parseEventDefinitionTypeFromObjectModel<TEventDefinition extends Model.Events.Definitions.EventDefinition>(
  rawProcessDefinition: object,
  tagName: BpmnTags.CommonElement,
  typeFactory: Model.Base.IConstructor<TEventDefinition>,
): Array<TEventDefinition> {

  const rawDefinitions = getModelPropertyAsArray(rawProcessDefinition, tagName);

  const collaborationHasNoMatchingDefinitions = !(rawDefinitions?.length > 0);
  if (collaborationHasNoMatchingDefinitions) {
    return [];
  }

  const eventDefinitions: Array<TEventDefinition> = [];

  for (const rawDefinition of rawDefinitions) {
    // eslint-disable-next-line 6river/new-cap
    const newDefinition = new typeFactory();

    newDefinition.id = rawDefinition.id;
    (newDefinition as any).name = rawDefinition.name;

    eventDefinitions.push(newDefinition);
  }

  return eventDefinitions;
}
