import {NotFoundError} from '@essential-projects/errors_ts';
import {BpmnTags, Model} from '@process-engine/process_model.contracts';

import {
  createObjectWithCommonProperties,
  getModelPropertyAsArray,
} from '../../type_factory';

let errors: Array<Model.GlobalElements.Error> = [];
let eventDefinitions: Array<Model.Events.Definitions.EventDefinition> = [];

export function parseEventsFromProcessData(
  processData: any,
  parsedErrors: Array<Model.GlobalElements.Error>,
  parsedEventDefinitions: Array<Model.Events.Definitions.EventDefinition>,
): Array<Model.Events.Event> {

  errors = parsedErrors;
  eventDefinitions = parsedEventDefinitions;

  const startEvents: Array<Model.Events.StartEvent> = parseEventsByType(processData, BpmnTags.EventElement.StartEvent, Model.Events.StartEvent);

  const endEvents: Array<Model.Events.EndEvent> = parseEndEvents(processData);

  const boundaryEvents: Array<Model.Events.BoundaryEvent> = parseBoundaryEvents(processData);

  const intermediateThrowEvents: Array<Model.Events.Event> =
    parseEventsByType(processData, BpmnTags.EventElement.IntermediateThrowEvent, Model.Events.IntermediateThrowEvent);

  const intermediateCatchEvents: Array<Model.Events.Event> =
    parseEventsByType(processData, BpmnTags.EventElement.IntermediateCatchEvent, Model.Events.IntermediateCatchEvent);

  return Array.prototype.concat(startEvents, endEvents, boundaryEvents, intermediateThrowEvents, intermediateCatchEvents);
}

/**
 * Parse all EndEvents of a process.
 * ErrorEndEvents will get their Errors attached to them.
 *
 * @param processData Parsed process definition data.
 * @param errors      List of process errors.
 * @returns           An array of parsed EndEvents.
 */
function parseEndEvents(processData: any): Array<Model.Events.EndEvent> {

  const endEventsRaw: any = getModelPropertyAsArray(processData, BpmnTags.EventElement.EndEvent);

  const events: Array<Model.Events.EndEvent> = endEventsRaw.map((endEventRaw: any): Model.Events.EndEvent => {
    return parseEndEvent(endEventRaw);
  });

  return events;
}

/**
 * Parses a single EndEvent from the given raw data.
 *
 * @param   endEventRaw The raw end event data.
 * @param   errors      Contains a list of error definitions.
 *                      If the EndEvent is an ErrorEndEvent, this list is used to retrieve the matching error definition.
 * @returns             The fully parsed EndEvent.
 */
function parseEndEvent(endEventRaw: any): Model.Events.EndEvent {

  const endEvent: Model.Events.EndEvent = createObjectWithCommonProperties(endEventRaw, Model.Events.EndEvent);

  endEvent.name = endEventRaw.name;
  endEvent.defaultOutgoingSequenceFlowId = endEventRaw.default;
  endEvent.incoming = getModelPropertyAsArray(endEventRaw, BpmnTags.FlowElementProperty.SequenceFlowIncoming);
  endEvent.outgoing = getModelPropertyAsArray(endEventRaw, BpmnTags.FlowElementProperty.SequenceFlowOutgoing);

  assignEventDefinitions(endEvent, endEventRaw);
  endEvent.inputValues = getInputValues(endEvent);

  return endEvent;
}

function parseBoundaryEvents(processData: any): Array<Model.Events.BoundaryEvent> {

  const events: Array<Model.Events.BoundaryEvent> = [];

  const boundaryEventsRaw: Array<any> = getModelPropertyAsArray(processData, BpmnTags.EventElement.Boundary);

  if (!boundaryEventsRaw || boundaryEventsRaw.length === 0) {
    return [];
  }

  for (const boundaryEventRaw of boundaryEventsRaw) {
    const boundaryEvent: Model.Events.BoundaryEvent = createObjectWithCommonProperties(boundaryEventRaw, Model.Events.BoundaryEvent);

    boundaryEvent.incoming = getModelPropertyAsArray(boundaryEventRaw, BpmnTags.FlowElementProperty.SequenceFlowIncoming);
    boundaryEvent.outgoing = getModelPropertyAsArray(boundaryEventRaw, BpmnTags.FlowElementProperty.SequenceFlowOutgoing);

    boundaryEvent.name = boundaryEventRaw.name;
    boundaryEvent.defaultOutgoingSequenceFlowId = boundaryEventRaw.default;
    boundaryEvent.attachedToRef = boundaryEventRaw.attachedToRef;

    // NOTE: Interrupting BoundaryEvents will sometimes not have this property!
    // However, non-interrupting BoundaryEvents always have it.
    const cancelActivity: boolean = boundaryEventRaw.cancelActivity === undefined ||
                                    boundaryEventRaw.cancelActivity === 'true' ||
                                    boundaryEventRaw.cancelActivity === true;
    boundaryEvent.cancelActivity = cancelActivity;

    assignEventDefinitions(boundaryEvent, boundaryEventRaw);

    events.push(boundaryEvent);
  }

  return events;
}

function parseEventsByType<TEvent extends Model.Events.Event>(
  data: any,
  eventType: BpmnTags.EventElement,
  type: Model.Base.IConstructor<TEvent>,
): Array<TEvent> {

  const events: Array<TEvent> = [];

  const eventsRaw: Array<any> = getModelPropertyAsArray(data, eventType);

  if (!eventsRaw || eventsRaw.length === 0) {
    return [];
  }

  for (const eventRaw of eventsRaw) {
    const event: TEvent = createObjectWithCommonProperties<TEvent>(eventRaw, type);
    event.name = eventRaw.name;
    event.defaultOutgoingSequenceFlowId = eventRaw.default;
    event.incoming = getModelPropertyAsArray(eventRaw, BpmnTags.FlowElementProperty.SequenceFlowIncoming);
    event.outgoing = getModelPropertyAsArray(eventRaw, BpmnTags.FlowElementProperty.SequenceFlowOutgoing);

    assignEventDefinitions(event, eventRaw);

    (event as any).inputValues = getInputValues(event);

    events.push(event);
  }

  return events;
}

function getInputValues<TEvent extends Model.Events.Event>(event: TEvent): any {

  const eventHasNoExtensionElements: boolean =
    !event.extensionElements ||
    !event.extensionElements.camundaExtensionProperties ||
    event.extensionElements.camundaExtensionProperties.length === 0;

  if (eventHasNoExtensionElements) {
    return undefined;
  }

  const extensionProperties: Array<Model.Base.Types.CamundaExtensionProperty> = event.extensionElements.camundaExtensionProperties;
  const inputValueProperty: Model.Base.Types.CamundaExtensionProperty = findExtensionPropertyByName('inputValues', extensionProperties);

  const payloadPropertyHasValue: boolean = inputValueProperty && inputValueProperty.value && inputValueProperty.value.length > 0;

  return payloadPropertyHasValue
    ? inputValueProperty.value
    : undefined;
}

function assignEventDefinitions(event: any, eventRaw: any): void {
  assignEventDefinition(event, eventRaw, BpmnTags.FlowElementProperty.ErrorEventDefinition, 'errorEventDefinition');
  assignEventDefinition(event, eventRaw, BpmnTags.FlowElementProperty.LinkEventDefinition, 'linkEventDefinition');
  assignEventDefinition(event, eventRaw, BpmnTags.FlowElementProperty.MessageEventDefinition, 'messageEventDefinition');
  assignEventDefinition(event, eventRaw, BpmnTags.FlowElementProperty.SignalEventDefinition, 'signalEventDefinition');
  assignEventDefinition(event, eventRaw, BpmnTags.FlowElementProperty.TerminateEventDefinition, 'terminateEventDefinition');
  assignEventDefinition(event, eventRaw, BpmnTags.FlowElementProperty.TimerEventDefinition, 'timerEventDefinition');
}

function assignEventDefinition(
  event: any, eventRaw: any,
  eventRawTagName: BpmnTags.FlowElementProperty,
  targetPropertyName: string,
): void {

  const eventDefinitonValue: any = eventRaw[eventRawTagName];

  const eventHasNoMatchingDefinition: boolean = eventDefinitonValue === undefined;
  if (eventHasNoMatchingDefinition) {
    return;
  }

  switch (targetPropertyName) {
    case 'errorEventDefinition':
      event[targetPropertyName] = retrieveErrorObject(eventRaw);
      break;
    case 'linkEventDefinition':
      // Unlinke messages and signals, links are not declared globally on a process model,
      // but exist only on the event to which they are attached.
      event[targetPropertyName] = new Model.Events.Definitions.LinkEventDefinition(eventDefinitonValue.name);
      break;
    case 'messageEventDefinition':
      event[targetPropertyName] = getDefinitionForEvent(eventDefinitonValue.messageRef);
      break;
    case 'signalEventDefinition':
      event[targetPropertyName] = getDefinitionForEvent(eventDefinitonValue.signalRef);
      break;
    case 'timerEventDefinition':
      event[targetPropertyName] = eventDefinitonValue;
      break;
    default:
      event[targetPropertyName] = {};
      break;
  }
}

function getDefinitionForEvent<TEventDefinition extends Model.Events.Definitions.EventDefinition>(eventDefinitionId: string): TEventDefinition {

  const matchingEventDefintion: Model.Events.Definitions.EventDefinition =
    eventDefinitions.find((entry: Model.Events.Definitions.EventDefinition): boolean => {
      return entry.id === eventDefinitionId;
    });

  return <TEventDefinition> matchingEventDefintion;
}

/**
 * Retrieves the error definition from the given error list, that belongs to the given error end event.
 * If the error is anonymous, an empty error object is returned.
 *
 * @param   endEventRaw The raw ErrorEndEvent.
 * @returns             The matching error definition.
 */
function retrieveErrorObject(errorEndEventRaw: any): Model.GlobalElements.Error {

  const errorIsNotAnonymous: boolean =
    errorEndEventRaw[BpmnTags.FlowElementProperty.ErrorEventDefinition] !== undefined &&
    errorEndEventRaw[BpmnTags.FlowElementProperty.ErrorEventDefinition] !== '';

  if (errorIsNotAnonymous) {
    const errorId: string = errorEndEventRaw[BpmnTags.FlowElementProperty.ErrorEventDefinition].errorRef;

    return getErrorById(errorId);
  }

  return {
    id: '',
    code: '',
    name: '',
  };
}

/**
 * Return the error with the given id from the raw error definition data.
 *
 * @param errorId ID of the error to find.
 * @returns       The retrieved Error.
 * @throws        404, if no matching error was found.
 */
function getErrorById(errorId: string): Model.GlobalElements.Error {

  const matchingError: Model.GlobalElements.Error = errors.find((entry: Model.GlobalElements.Error): boolean => {
    return entry.id === errorId;
  });

  if (!matchingError) {
    throw new NotFoundError(`No error with id ${errorId} found.`);
  }

  return matchingError;
}

function findExtensionPropertyByName(
  propertyName: string,
  extensionProperties: Array<Model.Base.Types.CamundaExtensionProperty>,
): Model.Base.Types.CamundaExtensionProperty {

  return extensionProperties.find((property: Model.Base.Types.CamundaExtensionProperty): boolean => {
    return property.name === propertyName;
  });
}
