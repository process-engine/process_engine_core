import {
  BpmnTags,
  Model,
  TimerDefinitionType,
} from '@process-engine/process_engine_contracts';

import {
  createObjectWithCommonProperties,
  getModelPropertyAsArray,
} from '../type_factory';

import {NotFoundError, UnprocessableEntityError} from '@essential-projects/errors_ts';

import * as moment from 'moment';

import {Logger} from 'loggerhythm';

enum TimerBpmnType {
  Duration = 'bpmn:timeDuration',
  Cycle = 'bpmn:timeCycle',
  Date = 'bpmn:timeDate',
}

let errors: Array<Model.Types.Error> = [];
let eventDefinitions: Array<Model.EventDefinitions.EventDefinition> = [];

export function parseEventsFromProcessData(
  processData: any,
  parsedErrors: Array<Model.Types.Error>,
  parsedEventDefinitions: Array<Model.EventDefinitions.EventDefinition>,
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

  const events: Array<Model.Events.EndEvent> = endEventsRaw.map((endEventRaw: any) => {
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

  endEvent.name = endEventRaw.name,
  endEvent.incoming = getModelPropertyAsArray(endEventRaw, BpmnTags.FlowElementProperty.SequenceFlowIncoming);
  endEvent.outgoing = getModelPropertyAsArray(endEventRaw, BpmnTags.FlowElementProperty.SequenceFlowOutgoing);

  assignEventDefinitions(endEvent, endEventRaw);

  return endEvent;
}

function parseBoundaryEvents(processData: any): Array<Model.Events.BoundaryEvent> {

  const events: Array<Model.Events.BoundaryEvent> = [];

  const boundaryEventsRaw: Array<any> = getModelPropertyAsArray(processData, BpmnTags.EventElement.Boundary);

  if (!boundaryEventsRaw || boundaryEventsRaw.length === 0) {
    return [];
  }

  for (const boundaryEventRaw of boundaryEventsRaw) {
    const event: Model.Events.BoundaryEvent = createObjectWithCommonProperties(boundaryEventRaw, Model.Events.BoundaryEvent);

    event.incoming = getModelPropertyAsArray(boundaryEventRaw, BpmnTags.FlowElementProperty.SequenceFlowIncoming);
    event.outgoing = getModelPropertyAsArray(boundaryEventRaw, BpmnTags.FlowElementProperty.SequenceFlowOutgoing);

    event.name = boundaryEventRaw.name;
    event.attachedToRef = boundaryEventRaw.attachedToRef;

    const cancelActivity: boolean = boundaryEventRaw.cancelActivity === 'true' ||
                                    boundaryEventRaw.cancelActivity === true;
    event.cancelActivity = cancelActivity;

    assignEventDefinitions(event, boundaryEventRaw);

    events.push(event);
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

  const checkIfCyclicTimersAreSafe: Function = (): boolean => {
    const cyclicTimerCheckRequired: boolean =
      eventsRaw.length > 1 &&
      eventType === BpmnTags.EventElement.StartEvent;

    if (cyclicTimerCheckRequired) {
      const hasTimerStartEvents: boolean = eventsRaw.some((eventRaw: any) => {
        return eventRaw[BpmnTags.FlowElementProperty.TimerEventDefinition] !== undefined;
      });

      const hasNonTimerStartEvents: boolean = eventsRaw.some((eventRaw: any) => {
        return eventRaw[BpmnTags.FlowElementProperty.TimerEventDefinition] === undefined;
      });

      return hasTimerStartEvents && hasNonTimerStartEvents;
    }

    return false;
  };

  const cyclicTimersAreSafe: boolean = checkIfCyclicTimersAreSafe();

  for (const eventRaw of eventsRaw) {
    const event: TEvent = createObjectWithCommonProperties<TEvent>(eventRaw, type);
    event.name = eventRaw.name;
    event.incoming = getModelPropertyAsArray(eventRaw, BpmnTags.FlowElementProperty.SequenceFlowIncoming);
    event.outgoing = getModelPropertyAsArray(eventRaw, BpmnTags.FlowElementProperty.SequenceFlowOutgoing);

    assignEventDefinitions(event, eventRaw, cyclicTimersAreSafe);

    events.push(event);
  }

  return events;
}

function assignEventDefinitions(event: any, eventRaw: any, ignoreCyclicTimer?: boolean): void {
  assignEventDefinition(event, eventRaw, BpmnTags.FlowElementProperty.ErrorEventDefinition, 'errorEventDefinition');
  assignEventDefinition(event, eventRaw, BpmnTags.FlowElementProperty.LinkEventDefinition, 'linkEventDefinition');
  assignEventDefinition(event, eventRaw, BpmnTags.FlowElementProperty.MessageEventDefinition, 'messageEventDefinition');
  assignEventDefinition(event, eventRaw, BpmnTags.FlowElementProperty.SignalEventDefinition, 'signalEventDefinition');
  assignEventDefinition(event, eventRaw, BpmnTags.FlowElementProperty.TerminateEventDefinition, 'terminateEventDefinition');
  assignEventDefinition(event, eventRaw, BpmnTags.FlowElementProperty.TimerEventDefinition, 'timerEventDefinition', ignoreCyclicTimer);
}

function assignEventDefinition(
  event: any, eventRaw: any,
  eventRawTagName: BpmnTags.FlowElementProperty,
  targetPropertyName: string,
  ignoreCyclicTimer?: boolean,
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
      event[targetPropertyName] = new Model.EventDefinitions.LinkEventDefinition(eventDefinitonValue.name);
      break;
    case 'messageEventDefinition':
      event[targetPropertyName] = getDefinitionForEvent(eventDefinitonValue.messageRef);
      break;
    case 'signalEventDefinition':
      event[targetPropertyName] = getDefinitionForEvent(eventDefinitonValue.signalRef);
      break;
    case 'timerEventDefinition':
      validateTimer(eventDefinitonValue, ignoreCyclicTimer);
      event[targetPropertyName] = eventDefinitonValue;
      break;
    default:
      event[targetPropertyName] = {};
      break;
  }
}

function getDefinitionForEvent<TEventDefinition extends Model.EventDefinitions.EventDefinition>(eventDefinitionId: string): TEventDefinition {

  const matchingEventDefintion: Model.EventDefinitions.EventDefinition =
    eventDefinitions.find((entry: Model.EventDefinitions.EventDefinition): boolean => {
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
function retrieveErrorObject(errorEndEventRaw: any): Model.Types.Error {

  const errorIsNotAnonymous: boolean = errorEndEventRaw[BpmnTags.FlowElementProperty.ErrorEventDefinition] !== '';

  if (errorIsNotAnonymous) {
    const errorId: string = errorEndEventRaw[BpmnTags.FlowElementProperty.ErrorEventDefinition].errorRef;

    return getErrorById(errorId);
  }

  return {
    id: '',
    structureRef: undefined,
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
function getErrorById(errorId: string): Model.Types.Error {

  const matchingError: Model.Types.Error = errors.find((entry: Model.Types.Error): boolean => {
    return entry.id === errorId;
  });

  if (!matchingError) {
    throw new NotFoundError(`No error with id ${errorId} found.`);
  }

  return matchingError;
}

function validateTimer(rawTimerDefinition: any, ignoreCyclic: boolean): void {
  const timerDefinitionType: TimerDefinitionType = parseTimerDefinitionType(rawTimerDefinition);
  const timerDefinitionValue: string = parseTimerDefinitionValue(rawTimerDefinition);
  validateTimerValue(timerDefinitionType, timerDefinitionValue, ignoreCyclic);
}

function validateTimerValue(timerType: TimerDefinitionType, timerValue: string, ignoreCyclic: boolean): void {
  switch (timerType) {
    case TimerDefinitionType.date: {
      const dateIsInvalid: boolean = !moment(timerValue, moment.ISO_8601).isValid();
      if (dateIsInvalid) {
        const errorMessage: string = `The given date definition ${timerValue} is not in ISO8601 format`;
        throw new UnprocessableEntityError(errorMessage);
      }

      break;
    }

    case TimerDefinitionType.duration: {
      /**
       * Note: Because of this Issue: https://github.com/moment/moment/issues/1805
       * we can't really use momentjs to validate durations against the
       * ISO8601 duration syntax.
       *
       * There is an isValid() method on moment.Duration objects but its
       * useless since it always returns true.
       */

      /**
       * Stolen from: https://stackoverflow.com/a/32045167
       */
       /*tslint:disable-next-line:max-line-length*/
      const durationRegex: RegExp = /^P(?!$)(\d+(?:\.\d+)?Y)?(\d+(?:\.\d+)?M)?(\d+(?:\.\d+)?W)?(\d+(?:\.\d+)?D)?(T(?=\d)(\d+(?:\.\d+)?H)?(\d+(?:\.\d+)?M)?(\d+(?:\.\d+)?S)?)?$/gm;
      const durationIsInvalid: boolean = !durationRegex.test(timerValue);

      if (durationIsInvalid) {
        const errorMessage: string = `The given duration definition ${timerValue} is not in ISO8601 format`;
        throw new UnprocessableEntityError(errorMessage);
      }

      break;
    }

    case TimerDefinitionType.cycle: {

      /**
       * Cyclic timers are safe, as long as there is at least one other StartEvent present.
       */
      if (ignoreCyclic) {
        const logger: Logger = Logger.createLogger('processengine:runtime:model:parser:event_parser');
        logger.warn('Cyclic Timer Events are currently not supported.');
        logger.warn('The defined Timer Start Event will currently never be executed!');

        return;
      }

      throw new UnprocessableEntityError('Cyclic timer definitions are currently unsupported!');
    }

    default: {
      throw new UnprocessableEntityError('Unknown Timer definition type');
    }
  }
}

function parseTimerDefinitionType(eventDefinition: any): TimerDefinitionType {

  const timerIsDuration: boolean = eventDefinition[TimerBpmnType.Duration] !== undefined;
  if (timerIsDuration) {
    return TimerDefinitionType.duration;
  }

  const timerIsCyclic: boolean = eventDefinition[TimerBpmnType.Cycle] !== undefined;
  if (timerIsCyclic) {
    return TimerDefinitionType.cycle;
  }

  const timerIsDate: boolean = eventDefinition[TimerBpmnType.Date] !== undefined;
  if (timerIsDate) {
    return TimerDefinitionType.date;
  }

  return undefined;
}

function parseTimerDefinitionValue(eventDefinition: any): string {

  const timerIsDuration: boolean = eventDefinition[TimerBpmnType.Duration] !== undefined;
  if (timerIsDuration) {
    return eventDefinition[TimerBpmnType.Duration]._;
  }

  const timerIsCyclic: boolean = eventDefinition[TimerBpmnType.Cycle] !== undefined;
  if (timerIsCyclic) {
    return eventDefinition[TimerBpmnType.Cycle]._;
  }

  const timerIsDate: boolean = eventDefinition[TimerBpmnType.Date] !== undefined;
  if (timerIsDate) {
    return eventDefinition[TimerBpmnType.Date]._;
  }

  return undefined;
}
