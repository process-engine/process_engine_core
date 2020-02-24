import {Logger} from 'loggerhythm';

import {UnprocessableEntityError} from '@essential-projects/errors_ts';

import {BpmnTags, Model} from '@process-engine/persistence_api.contracts';

import {createObjectWithCommonProperties, getModelPropertyAsArray} from '../../type_factory';
import {findExtensionPropertyByName} from './activity_parsers/extension_property_parser';

const logger = Logger.createLogger('atlasengine:process_model_parser:event_parser');

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

  const noEventsFound = !(eventsRaw?.length > 0);
  if (noEventsFound) {
    return [];
  }

  for (const eventRaw of eventsRaw) {
    const event = createObjectWithCommonProperties<TEvent>(eventRaw, targetType);
    event.name = eventRaw.name;
    event.defaultOutgoingSequenceFlowId = eventRaw.default;
    event.incoming = getModelPropertyAsArray(eventRaw, BpmnTags.FlowElementProperty.SequenceFlowIncoming);
    event.outgoing = getModelPropertyAsArray(eventRaw, BpmnTags.FlowElementProperty.SequenceFlowOutgoing);

    assignEventDefinition(event, eventRaw);

    setInputValues(event);

    events.push(event);
  }

  return events;
}

function parseBoundaryEvents(processData: any): Array<Model.Events.BoundaryEvent> {

  const events: Array<Model.Events.BoundaryEvent> = [];

  const boundaryEventsRaw = getModelPropertyAsArray(processData, BpmnTags.EventElement.Boundary);

  const noBoundaryEventsFound = !(boundaryEventsRaw?.length > 0);
  if (noBoundaryEventsFound) {
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
    const cancelActivity = boundaryEventRaw.cancelActivity == undefined ||
                           boundaryEventRaw.cancelActivity === 'true' ||
                           boundaryEventRaw.cancelActivity === true;
    boundaryEvent.cancelActivity = cancelActivity;

    assignEventDefinition(boundaryEvent, boundaryEventRaw);

    const isCyclicTimerBoundaryEvent = boundaryEvent.timerEventDefinition?.timerType === Model.Events.Definitions.TimerType.timeCycle;
    if (isCyclicTimerBoundaryEvent) {
      createAndThrowValidationError(boundaryEvent, boundaryEventRaw, 'Using cyclic timers for BoundaryEvents is not allowed!');
    }

    events.push(boundaryEvent);
  }

  return events;
}

function assignEventDefinition<TEvent extends Model.Events.Event>(event: TEvent, eventRaw: any): void {
  const eventHasErrorEvent = eventRaw[BpmnTags.FlowElementProperty.ErrorEventDefinition] != undefined;
  const eventHasLinkEvent = eventRaw[BpmnTags.FlowElementProperty.LinkEventDefinition] != undefined;
  const eventHasMessageEvent = eventRaw[BpmnTags.FlowElementProperty.MessageEventDefinition] != undefined;
  const eventHasSignalEvent = eventRaw[BpmnTags.FlowElementProperty.SignalEventDefinition] != undefined;
  const eventHasTimerEvent = eventRaw[BpmnTags.FlowElementProperty.TimerEventDefinition] != undefined;
  const eventHasTerminateEvent = eventRaw[BpmnTags.FlowElementProperty.TerminateEventDefinition] != undefined;

  // Might look a little weird, but counting "true" values is actually a lot easier than trying out every possible combo.
  // It doesn't matter which events are modelled anyway, as soon as there is more than one, the FlowNode is simply not usable.
  const allResults = [eventHasErrorEvent, eventHasLinkEvent, eventHasMessageEvent, eventHasSignalEvent, eventHasTimerEvent, eventHasTerminateEvent];

  const eventHasTooManyDefinitions = allResults.filter((entry): boolean => entry === true).length > 1;
  if (eventHasTooManyDefinitions) {
    createAndThrowValidationError(event, eventRaw, `Event '${event}' has more than one type of event definition! This is not permitted!`);
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
    (event as any).terminateEventDefinition = {};
  } else if (eventHasLinkEvent) {
    assignLinkEventDefinition(event, eventRaw);
  }
}

function assignErrorEventDefinition<TEvent extends Model.Events.Event>(event: TEvent, eventRaw: any): void {

  const errorId = eventRaw[BpmnTags.FlowElementProperty.ErrorEventDefinition]?.errorRef;

  const defaultError = {
    id: '',
    code: '',
    name: '',
    message: '',
  };

  const errorObject = errorId
    ? errors.find((entry: Model.GlobalElements.Error): boolean => entry.id === errorId)
    : defaultError;

  if (!errorObject) {
    createAndThrowValidationError(event, eventRaw, `Error reference on event ${event.id} is invalid!`);
  }

  // TODO: Move base EventDefinition properties to base Event type.
  (event as any).errorEventDefinition = errorObject;
}

function assignLinkEventDefinition<TEvent extends Model.Events.Event>(event: TEvent, eventRaw: any): void {
  const eventDefinitonRaw = eventRaw[BpmnTags.FlowElementProperty.LinkEventDefinition];

  if (!eventDefinitonRaw?.name) {
    // TODO: Usually, this should throw an error. However, doing so would break the "GetAllProcessModels" queries,
    // which would in turn break BPMN Studio and thus leaving the user without any way to fix the diagram.
    // Maybe we should think about introducting some kind of leniency setting for the parser, to be able to only throw errors in certain UseCases.
    logger.warn(`LinkEvent with ID ${event.id} is missing a link name! The event will not be executable!`);
    logger.warn('EventData: ', event);
  }

  // TODO: Move base EventDefinition properties to base Event type.
  (event as any).linkEventDefinition = new Model.Events.Definitions.LinkEventDefinition(eventDefinitonRaw.name);
}

function assignMessageEventDefinition<TEvent extends Model.Events.Event>(event: TEvent, eventRaw: any): void {
  const eventDefinitonRaw = eventRaw[BpmnTags.FlowElementProperty.MessageEventDefinition];

  const messageDefinition = getDefinitionForEvent<Model.Events.MessageEventDefinition>(eventDefinitonRaw?.messageRef);

  if (!messageDefinition) {
    // same as above
    logger.warn(`Message reference '${eventDefinitonRaw?.messageRef}' on MessageEvent ${event.id} is invalid! The event will not be executable!`);
    logger.warn('EventData: ', event);
  }

  // TODO: Move base EventDefinition properties to base Event type.
  (event as any).messageEventDefinition = messageDefinition;
}

function assignSignalEventDefinition<TEvent extends Model.Events.Event>(event: TEvent, eventRaw: any): void {
  const eventDefinitonRaw = eventRaw[BpmnTags.FlowElementProperty.SignalEventDefinition];

  const signalDefinition = getDefinitionForEvent<Model.Events.SignalEventDefinition>(eventDefinitonRaw?.signalRef);

  if (!signalDefinition) {
    // Same as above.
    logger.warn(`Signal reference '${eventDefinitonRaw?.signalRef}' on SignalEvent ${event.id} is invalid! The event will not be executable!`);
    logger.warn('EventData: ', event);
  }

  // TODO: Move base EventDefinition properties to base Event type.
  (event as any).signalEventDefinition = signalDefinition;
}

function assignTimerEventDefinition<TEvent extends Model.Events.Event>(event: TEvent, eventRaw: any): void {

  const eventDefinitonValue = eventRaw[BpmnTags.FlowElementProperty.TimerEventDefinition];

  const isEnabledCamundaProperty = event?.extensionElements?.camundaExtensionProperties
    ? findExtensionPropertyByName('enabled', event.extensionElements.camundaExtensionProperties)
    : undefined;

  const isEnabled = isEnabledCamundaProperty != undefined
    ? isEnabledCamundaProperty.value === 'true'
    : true;

  const timerType = parseTimerDefinitionType(eventDefinitonValue);
  const timerValue = parseTimerDefinitionValue(eventDefinitonValue);

  if (timerType == undefined || !(timerValue?.length > 0)) {
    // Same as above.
    logger.warn(`Timer reference on TimerEvent ${event.id} is invalid! The event will not be executable!`);
    logger.warn('EventData: ', event);
  }

  const timerDefinition = new Model.Events.Definitions.TimerEventDefinition();
  timerDefinition.enabled = isEnabled;
  timerDefinition.timerType = timerType;
  timerDefinition.value = timerValue;

  // TODO: Move base EventDefinition properties to base Event type.
  (event as any).timerEventDefinition = timerDefinition;
}

function parseTimerDefinitionType(eventDefinition: any): Model.Events.Definitions.TimerType {

  const timerIsCyclic = eventDefinition[TimerEventDefinitionBpmnTag.Cycle] != undefined;
  if (timerIsCyclic) {
    return Model.Events.Definitions.TimerType.timeCycle;
  }

  const timerIsDate = eventDefinition[TimerEventDefinitionBpmnTag.Date] != undefined;
  if (timerIsDate) {
    return Model.Events.Definitions.TimerType.timeDate;
  }

  const timerIsDuration = eventDefinition[TimerEventDefinitionBpmnTag.Duration] != undefined;
  if (timerIsDuration) {
    return Model.Events.Definitions.TimerType.timeDuration;
  }

  return undefined;
}

function parseTimerDefinitionValue(eventDefinition: any): string {

  const timerIsCyclic = eventDefinition[TimerEventDefinitionBpmnTag.Cycle] != undefined;
  if (timerIsCyclic) {
    return eventDefinition[TimerEventDefinitionBpmnTag.Cycle]._;
  }

  const timerIsDate = eventDefinition[TimerEventDefinitionBpmnTag.Date] != undefined;
  if (timerIsDate) {
    return eventDefinition[TimerEventDefinitionBpmnTag.Date]._;
  }

  const timerIsDuration = eventDefinition[TimerEventDefinitionBpmnTag.Duration] != undefined;
  if (timerIsDuration) {
    return eventDefinition[TimerEventDefinitionBpmnTag.Duration]._;
  }

  return undefined;
}

function getDefinitionForEvent<TEventDefinition extends Model.Events.Definitions.EventDefinition>(eventDefinitionId: string): TEventDefinition {
  return <TEventDefinition> eventDefinitions.find((entry): boolean => entry.id === eventDefinitionId);
}

function setInputValues<TEvent extends Model.Events.Event>(event: TEvent): void {
  (event as any).inputValues = findExtensionPropertyByName('inputValues', event.extensionElements.camundaExtensionProperties)?.value;
}

function createAndThrowValidationError<TEvent extends Model.Events.Event>(event: TEvent, eventRaw: any, message: string): void {
  logger.error(message);

  const error = new UnprocessableEntityError(message);
  error.additionalInformation = {
    eventObject: event,
    rawEventData: eventRaw,
  };

  throw error;
}
