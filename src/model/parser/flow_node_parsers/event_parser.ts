import {Logger} from 'loggerhythm';

import {UnprocessableEntityError} from '@essential-projects/errors_ts';
import {BpmnTags, Model} from '@process-engine/persistence_api.contracts';

import {
  createObjectWithCommonProperties,
  getModelPropertyAsArray,
} from '../../type_factory';
import {findExtensionPropertyByName} from './activity_parsers/extension_property_parser';

const logger = Logger.createLogger('processengine:model_parser:event_parser');

let errors: Array<Model.GlobalElements.Error> = [];
let eventDefinitions: Array<Model.Events.Definitions.EventDefinition> = [];

enum TimerEventDefinitionBpmnTag {
  Duration = 'bpmn:timeDuration',
  Cycle = 'bpmn:timeCycle',
  Date = 'bpmn:timeDate',
}

export function parseEventsFromProcessData(
  processData: any,
  parsedErrors: Array<Model.GlobalElements.Error>,
  parsedEventDefinitions: Array<Model.Events.Definitions.EventDefinition>,
): Array<Model.Events.Event> {

  errors = parsedErrors;
  eventDefinitions = parsedEventDefinitions;

  const startEvents = parseEventsByType(processData, BpmnTags.EventElement.StartEvent, Model.Events.StartEvent);
  const endEvents = parseEventsByType(processData, BpmnTags.EventElement.EndEvent, Model.Events.EndEvent);

  const intermediateThrowEvents = parseEventsByType(processData, BpmnTags.EventElement.IntermediateThrowEvent, Model.Events.IntermediateThrowEvent);
  const intermediateCatchEvents = parseEventsByType(processData, BpmnTags.EventElement.IntermediateCatchEvent, Model.Events.IntermediateCatchEvent);

  const boundaryEvents = parseBoundaryEvents(processData);

  return Array.prototype.concat(startEvents, endEvents, intermediateThrowEvents, intermediateCatchEvents, boundaryEvents);
}

function parseEventsByType<TEvent extends Model.Events.Event>(
  data: any,
  eventTypeTag: BpmnTags.EventElement,
  targetType: Model.Base.IConstructor<TEvent>,
): Array<TEvent> {

  const events: Array<TEvent> = [];

  const eventsRaw = getModelPropertyAsArray(data, eventTypeTag);

  if (!eventsRaw || eventsRaw.length === 0) {
    return [];
  }

  for (const eventRaw of eventsRaw) {
    const event = createObjectWithCommonProperties<TEvent>(eventRaw, targetType);
    event.name = eventRaw.name;
    event.defaultOutgoingSequenceFlowId = eventRaw.default;
    event.incoming = getModelPropertyAsArray(eventRaw, BpmnTags.FlowElementProperty.SequenceFlowIncoming);
    event.outgoing = getModelPropertyAsArray(eventRaw, BpmnTags.FlowElementProperty.SequenceFlowOutgoing);

    assignEventDefinition(event, eventRaw);

    (event as any).inputValues = getInputValues(event);

    events.push(event);
  }

  return events;
}

function parseBoundaryEvents(processData: any): Array<Model.Events.BoundaryEvent> {

  const events: Array<Model.Events.BoundaryEvent> = [];

  const boundaryEventsRaw = getModelPropertyAsArray(processData, BpmnTags.EventElement.Boundary);

  if (!boundaryEventsRaw || boundaryEventsRaw.length === 0) {
    return [];
  }

  for (const boundaryEventRaw of boundaryEventsRaw) {
    const boundaryEvent = createObjectWithCommonProperties(boundaryEventRaw, Model.Events.BoundaryEvent);

    boundaryEvent.incoming = getModelPropertyAsArray(boundaryEventRaw, BpmnTags.FlowElementProperty.SequenceFlowIncoming);
    boundaryEvent.outgoing = getModelPropertyAsArray(boundaryEventRaw, BpmnTags.FlowElementProperty.SequenceFlowOutgoing);

    boundaryEvent.name = boundaryEventRaw.name;
    boundaryEvent.defaultOutgoingSequenceFlowId = boundaryEventRaw.default;
    boundaryEvent.attachedToRef = boundaryEventRaw.attachedToRef;

    // NOTE: Interrupting BoundaryEvents are sometimes missing this property!
    // However, non-interrupting BoundaryEvents always have it.
    const cancelActivity = boundaryEventRaw.cancelActivity === undefined ||
                           boundaryEventRaw.cancelActivity === 'true' ||
                           boundaryEventRaw.cancelActivity === true;
    boundaryEvent.cancelActivity = cancelActivity;

    assignEventDefinition(boundaryEvent, boundaryEventRaw);

    const isCyclicTimerBoundaryEvent =
      boundaryEvent.timerEventDefinition &&
      boundaryEvent.timerEventDefinition.timerType === Model.Events.Definitions.TimerType.timeCycle;

    if (isCyclicTimerBoundaryEvent) {
      const errorMessage = 'Using cyclic timers for BoundaryEvents is not allowed!';
      logger.error(errorMessage, boundaryEvent);
      throw new UnprocessableEntityError(errorMessage);
    }

    events.push(boundaryEvent);
  }

  return events;
}

function getInputValues<TEvent extends Model.Events.Event>(event: TEvent): any {

  const eventHasNoExtensionElements =
    !event.extensionElements ||
    !event.extensionElements.camundaExtensionProperties ||
    event.extensionElements.camundaExtensionProperties.length === 0;

  if (eventHasNoExtensionElements) {
    return undefined;
  }

  const extensionProperties = event.extensionElements.camundaExtensionProperties;
  const inputValueProperty = findExtensionPropertyByName('inputValues', extensionProperties);

  const payloadPropertyHasValue = inputValueProperty && inputValueProperty.value && inputValueProperty.value.length > 0;

  return payloadPropertyHasValue
    ? inputValueProperty.value
    : undefined;
}

function assignEventDefinition(event: any, eventRaw: any): void {

  const eventHasErrorEvent = eventRaw[BpmnTags.FlowElementProperty.ErrorEventDefinition] !== undefined;
  const eventHasLinkEvent = eventRaw[BpmnTags.FlowElementProperty.LinkEventDefinition] !== undefined;
  const eventHasMessageEvent = eventRaw[BpmnTags.FlowElementProperty.MessageEventDefinition] !== undefined;
  const eventHasSignalEvent = eventRaw[BpmnTags.FlowElementProperty.SignalEventDefinition] !== undefined;
  const eventHasTimerEvent = eventRaw[BpmnTags.FlowElementProperty.TimerEventDefinition] !== undefined;
  const eventHasTerminateEvent = eventRaw[BpmnTags.FlowElementProperty.TerminateEventDefinition] !== undefined;

  // Might look a little weird, but counting "true" values is actually a lot easier than trying out every possible combo.
  // It doesn't matter which events are modelled anyway, as soon as there is more than one, the FlowNode is simply not usable.
  const allResults = [eventHasErrorEvent, eventHasLinkEvent, eventHasMessageEvent, eventHasSignalEvent, eventHasTimerEvent, eventHasTerminateEvent];

  const eventHasTooManyDefinitions = allResults.filter((entry): boolean => entry === true).length > 1;
  if (eventHasTooManyDefinitions) {
    const message = `Event '${event}' has more than one type of event definition! This is not permitted!`;
    logger.error(message);

    const error = new UnprocessableEntityError(message);
    error.additionalInformation = {
      eventObject: event,
      rawEventData: eventRaw,
    } as any;

    throw error;
  }

  if (eventHasErrorEvent) {
    assignErrorEventDefinition(event, eventRaw);
  } else if (eventHasMessageEvent) {
    assignMessageEventDefinition(event, eventRaw);
  } else if (eventHasSignalEvent) {
    assignSignalEventDefinition(event, eventRaw);
  } else if (eventHasTimerEvent) {
    assignTimerEventDefinition(event, eventRaw);
  } else if (eventHasTerminateEvent) {
    event.terminateEventDefinition = {};
  } else if (eventHasLinkEvent) {
    assignLinkEventDefinition(event, eventRaw);
  }
}

function assignErrorEventDefinition(event: any, eventRaw: any): void {
  const errorObject = retrieveErrorObject(eventRaw);

  if (!errorObject) {
    const errorMessage = `Error reference on event ${event.id} is invalid!`;

    logger.error(errorMessage);

    const error = new UnprocessableEntityError(errorMessage);
    error.additionalInformation = {
      eventObject: event,
      rawEventData: eventRaw,
    } as any;

    throw error;
  }

  event.errorEventDefinition = errorObject;
}

function assignLinkEventDefinition(event: any, eventRaw: any): void {
  const eventDefinitonValue = eventRaw[BpmnTags.FlowElementProperty.LinkEventDefinition];
  event.linkEventDefinition = new Model.Events.Definitions.LinkEventDefinition(eventDefinitonValue.name);
}

function assignMessageEventDefinition(event: any, eventRaw: any): void {
  const eventDefinitonValue = eventRaw[BpmnTags.FlowElementProperty.MessageEventDefinition];
  const messageDefinition = getDefinitionForEvent(eventDefinitonValue.messageRef);

  if (!messageDefinition) {
    // TODO: Usually, this should throw an error. However, doing so would brek the "GetAllProcessModels" queries,
    // which would in turn break BPMN Studio and thus leaving the user without any way to fix the diagram.s
    // Maybe we should think about introducting some kind of leniency setting for the parser, to be able to only throw errors in certain UseCases.
    logger.warn(
      `Message reference '${eventDefinitonValue.messageRef}' on Event with ID ${event.id} is invalid! The event will not be executable!`,
      event,
      eventRaw,
    );
  }

  event.messageEventDefinition = messageDefinition;
}

function assignSignalEventDefinition(event: any, eventRaw: any): void {
  const eventDefinitonValue = eventRaw[BpmnTags.FlowElementProperty.SignalEventDefinition];
  const signalDefinition = getDefinitionForEvent(eventDefinitonValue.signalRef);

  if (!signalDefinition) {
    // Same as above.
    logger.warn(
      `Signal reference '${eventDefinitonValue.signalRef}' on Event with ID ${event.id} is invalid! The event will not be executable!`,
      event,
      eventRaw,
    );
  }

  event.signalEventDefinition = signalDefinition;
}

function assignTimerEventDefinition(event: any, eventRaw: any): void {

  const eventDefinitonValue = eventRaw[BpmnTags.FlowElementProperty.TimerEventDefinition];

  const isEnabledCamundaProperty = event.extensionElements && event.extensionElements.camundaExtensionProperties
    ? findExtensionPropertyByName('enabled', event.extensionElements.camundaExtensionProperties)
    : undefined;

  const isEnabled = isEnabledCamundaProperty !== undefined
    ? isEnabledCamundaProperty.value === 'true'
    : true;

  const timerType = parseTimerDefinitionType(eventDefinitonValue);
  const timerValue = parseTimerDefinitionValue(eventDefinitonValue);

  if (timerType === undefined || timerValue === undefined || timerValue.length === 0) {
    // Same as above.
    logger.warn(`The timer on event with ID ${event.id} is invalid! The event will not be executable!`, event, eventRaw);
  }

  const timerDefinition = new Model.Events.Definitions.TimerEventDefinition();
  timerDefinition.enabled = isEnabled;
  timerDefinition.timerType = timerType;
  timerDefinition.value = timerValue;

  event.timerEventDefinition = timerDefinition;
}

function getDefinitionForEvent<TEventDefinition extends Model.Events.Definitions.EventDefinition>(eventDefinitionId: string): TEventDefinition {

  const matchingEventDefintion: Model.Events.Definitions.EventDefinition =
    eventDefinitions.find((entry: Model.Events.Definitions.EventDefinition): boolean => {
      return entry.id === eventDefinitionId;
    });

  return <TEventDefinition> matchingEventDefintion;
}

/**
 * Retrieves the error definition that belongs to the given ErrorEndEvent.
 * If no error reference is attached, an empty error object is returned.
 *
 * @param   endEventRaw The raw ErrorEndEvent.
 * @returns             The matching error definition.
 */
function retrieveErrorObject(errorEndEventRaw: any): Model.GlobalElements.Error {

  const eventHasNoErrorReference =
    errorEndEventRaw[BpmnTags.FlowElementProperty.ErrorEventDefinition] === undefined ||
    errorEndEventRaw[BpmnTags.FlowElementProperty.ErrorEventDefinition] === '';

  if (eventHasNoErrorReference) {
    return {
      id: '',
      code: '',
      name: '',
      message: '',
    };
  }
  const errorId = errorEndEventRaw[BpmnTags.FlowElementProperty.ErrorEventDefinition].errorRef;

  return getErrorById(errorId);
}

/**
 * Return the error with the given id from the raw error definition data.
 *
 * @param errorId ID of the error to find.
 * @returns       The retrieved Error.
 * @throws        404, if no matching error was found.
 */
function getErrorById(errorId: string): Model.GlobalElements.Error {

  const matchingError = errors.find((entry: Model.GlobalElements.Error): boolean => {
    return entry.id === errorId;
  });

  return matchingError;
}

function parseTimerDefinitionType(eventDefinition: any): Model.Events.Definitions.TimerType {

  const timerIsCyclic = eventDefinition[TimerEventDefinitionBpmnTag.Cycle] !== undefined;
  if (timerIsCyclic) {
    return Model.Events.Definitions.TimerType.timeCycle;
  }

  const timerIsDate = eventDefinition[TimerEventDefinitionBpmnTag.Date] !== undefined;
  if (timerIsDate) {
    return Model.Events.Definitions.TimerType.timeDate;
  }

  const timerIsDuration = eventDefinition[TimerEventDefinitionBpmnTag.Duration] !== undefined;
  if (timerIsDuration) {
    return Model.Events.Definitions.TimerType.timeDuration;
  }

  return undefined;
}

function parseTimerDefinitionValue(eventDefinition: any): string {

  const timerIsCyclic = eventDefinition[TimerEventDefinitionBpmnTag.Cycle] !== undefined;
  if (timerIsCyclic) {
    return eventDefinition[TimerEventDefinitionBpmnTag.Cycle]._;
  }

  const timerIsDate = eventDefinition[TimerEventDefinitionBpmnTag.Date] !== undefined;
  if (timerIsDate) {
    return eventDefinition[TimerEventDefinitionBpmnTag.Date]._;
  }

  const timerIsDuration = eventDefinition[TimerEventDefinitionBpmnTag.Duration] !== undefined;
  if (timerIsDuration) {
    return eventDefinition[TimerEventDefinitionBpmnTag.Duration]._;
  }

  return undefined;
}
