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
    const cancelActivity = boundaryEventRaw.cancelActivity === undefined ||
                           boundaryEventRaw.cancelActivity === 'true' ||
                           boundaryEventRaw.cancelActivity === true;
    boundaryEvent.cancelActivity = cancelActivity;

    assignEventDefinition(boundaryEvent, boundaryEventRaw);

    const isCyclicTimerBoundaryEvent = boundaryEvent.timerEventDefinition?.timerType === Model.Events.Definitions.TimerType.timeCycle;
    if (isCyclicTimerBoundaryEvent) {
      const errorMessage = 'Using cyclic timers for BoundaryEvents is not allowed!';
      logger.error(errorMessage);
      throw new UnprocessableEntityError(errorMessage);
    }

    events.push(boundaryEvent);
  }

  return events;
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
    };

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

  const errorId = eventRaw[BpmnTags.FlowElementProperty.ErrorEventDefinition].errorRef;

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
    const errorMessage = `Error reference on event ${event.id} is invalid!`;

    logger.error(errorMessage);

    const error = new UnprocessableEntityError(errorMessage);
    error.additionalInformation = {
      eventObject: event,
      rawEventData: eventRaw,
    };

    throw error;
  }

  event.errorEventDefinition = errorObject;
}

function assignLinkEventDefinition(event: any, eventRaw: any): void {
  const eventDefinitonValue = eventRaw[BpmnTags.FlowElementProperty.LinkEventDefinition];
  event.linkEventDefinition = new Model.Events.Definitions.LinkEventDefinition(eventDefinitonValue.name);
}

function assignMessageEventDefinition(event: any, eventRaw: any): void {
  const eventDefinitonValue = eventRaw[BpmnTags.FlowElementProperty.MessageEventDefinition].messageRef;
  const messageDefinition = getDefinitionForEvent(eventDefinitonValue);

  if (!messageDefinition) {
    // TODO: Usually, this should throw an error. However, doing so would brek the "GetAllProcessModels" queries,
    // which would in turn break BPMN Studio and thus leaving the user without any way to fix the diagram.
    // Maybe we should think about introducting some kind of leniency setting for the parser, to be able to only throw errors in certain UseCases.
    logger.warn(`Message reference '${eventDefinitonValue.messageRef}' on Event ${event.id} is invalid! The event will not be executable!`, event);
  }

  event.messageEventDefinition = messageDefinition;
}

function assignSignalEventDefinition(event: any, eventRaw: any): void {
  const eventDefinitonValue = eventRaw[BpmnTags.FlowElementProperty.SignalEventDefinition].signalRef;
  const signalDefinition = getDefinitionForEvent(eventDefinitonValue);

  if (!signalDefinition) {
    // Same as above.
    logger.warn(`Signal reference '${eventDefinitonValue.signalRef}' on Event ${event.id} is invalid! The event will not be executable!`, event);
  }

  event.signalEventDefinition = signalDefinition;
}

function assignTimerEventDefinition(event: any, eventRaw: any): void {

  const eventDefinitonValue = eventRaw[BpmnTags.FlowElementProperty.TimerEventDefinition];

  const isEnabledCamundaProperty = event?.extensionElements?.camundaExtensionProperties
    ? findExtensionPropertyByName('enabled', event.extensionElements.camundaExtensionProperties)
    : undefined;

  const isEnabled = isEnabledCamundaProperty !== undefined
    ? isEnabledCamundaProperty.value === 'true'
    : true;

  const timerType = parseTimerDefinitionType(eventDefinitonValue);
  const timerValue = parseTimerDefinitionValue(eventDefinitonValue);

  if (timerType == undefined || !(timerValue?.length > 0)) {
    // Same as above.
    logger.warn(`The timer on event with ID ${event.id} is invalid! The event will not be executable!`, event, eventRaw);
  }

  const timerDefinition = new Model.Events.Definitions.TimerEventDefinition();
  timerDefinition.enabled = isEnabled;
  timerDefinition.timerType = timerType;
  timerDefinition.value = timerValue;

  event.timerEventDefinition = timerDefinition;
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

function getDefinitionForEvent<TEventDefinition extends Model.Events.Definitions.EventDefinition>(eventDefinitionId: string): TEventDefinition {
  return <TEventDefinition> eventDefinitions.find((entry): boolean => entry.id === eventDefinitionId);
}

function setInputValues<TEvent extends Model.Events.Event>(event: TEvent): void {
  (event as any).inputValues = findExtensionPropertyByName('inputValues', event.extensionElements.camundaExtensionProperties)?.value;
}
