import {
  BpmnTags,
  Model,
} from '@process-engine/process_engine_contracts';

import {
  createObjectWithCommonProperties,
  getModelPropertyAsArray,
  setCommonObjectPropertiesFromData,
} from '../type_factory';

export function parseEventsFromProcessData(processData: any, errors: Array<Model.Types.Error>): Array<Model.Events.Event> {

  const startEvents: Array<Model.Events.StartEvent>
    = parseEventsByType(processData, BpmnTags.EventElement.StartEvent, Model.Events.StartEvent);

  const endEvents: Array<Model.Events.EndEvent> = parseEndEvents(processData, errors);

  const boundaryEvents: Array<Model.Events.BoundaryEvent> = parseBoundaryEvents(processData);

  const intermediateCatchEvents: Array<Model.Events.Event> = parseIntermediateCatchEvents(processData);

  return Array.prototype.concat(startEvents, boundaryEvents, intermediateCatchEvents, endEvents);
}

function parseIntermediateCatchEvents(processData: any): Array<Model.Events.IntermediateCatchEvent> {
  const events: Array<Model.Events.IntermediateCatchEvent> = [];

  const intermediateCatchEventsRaw: Array<any> = getModelPropertyAsArray(processData, BpmnTags.EventElement.IntermediateCatchEvent);

  if (!intermediateCatchEventsRaw || intermediateCatchEventsRaw.length === 0) {
    return [];
  }

  for (const intermediateCatchEventRaw of intermediateCatchEventsRaw) {
    // tslint:disable-next-line:max-line-length
    const event: Model.Events.IntermediateCatchEvent = createObjectWithCommonProperties(intermediateCatchEventRaw, Model.Events.IntermediateCatchEvent);

    event.incoming = getModelPropertyAsArray(intermediateCatchEventRaw, BpmnTags.FlowElementProperty.SequenceFlowIncoming);
    event.outgoing = getModelPropertyAsArray(intermediateCatchEventRaw, BpmnTags.FlowElementProperty.SequenceFlowOutgoing);

    event.name = intermediateCatchEventRaw.name;

    assignEventDefinitions(event, intermediateCatchEventRaw);

    events.push(event);
  }

  return events;
}

function assignEventDefinitions(event: any, eventRaw: any): void {

  assignEventDefinition(event, eventRaw, BpmnTags.FlowElementProperty.ErrorEventDefinition, 'errorEventDefinition');
  assignEventDefinition(event, eventRaw, BpmnTags.FlowElementProperty.TimerEventDefinition, 'timerEventDefinition');
  assignEventDefinition(event, eventRaw, BpmnTags.FlowElementProperty.TerminateEventDefinition, 'terminateEventDefinition');
  assignEventDefinition(event, eventRaw, BpmnTags.FlowElementProperty.MessageEventDefinition, 'messageEventDefinition');
  assignEventDefinition(event, eventRaw, BpmnTags.FlowElementProperty.SignalEventDefinition, 'signalEventDefinition');

}

function assignEventDefinition(event: any, eventRaw: any, eventRawTagName: string, targetPropertyName: string): void {
  let eventDefinitonValue: any = eventRaw[eventRawTagName];
  if (eventDefinitonValue === '') {
    eventDefinitonValue = {};
  }
  if (eventDefinitonValue !== undefined && eventDefinitonValue !== null) {
    event[targetPropertyName] = eventDefinitonValue;
  }
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
    event.cancelActivity = boundaryEventRaw.cancelActivity || true;

    assignEventDefinitions(event, boundaryEventRaw);

    events.push(event);
  }

  return events;
}

/**
 * Parse all EndEvents of a process.
 * ErrorEndEvents will get their Errors attached to them.
 *
 * @param data Parsed process definition data
 * @param errors List of process errors
 * @returns an array of parsed EndEvents
 */
function parseEndEvents(data: any, errors: Array<Model.Types.Error>): Array<Model.Events.EndEvent> {
  const events: Array<Model.Events.EndEvent> = [];

  // Build end events
  const endEventsRaw: any = getModelPropertyAsArray(data, BpmnTags.EventElement.EndEvent);

  for (const endEventRaw of endEventsRaw) {
    const event: Model.Events.EndEvent = createObjectWithCommonProperties(endEventRaw, Model.Events.EndEvent);

    event.name = endEventRaw.name,
    event.incoming = getModelPropertyAsArray(endEventRaw, BpmnTags.FlowElementProperty.SequenceFlowIncoming);
    event.outgoing = getModelPropertyAsArray(endEventRaw, BpmnTags.FlowElementProperty.SequenceFlowOutgoing);

    const eventHasErrorEventDefinition: boolean = endEventRaw.hasOwnProperty(BpmnTags.FlowElementProperty.ErrorEventDefinition);

    if (eventHasErrorEventDefinition) {
      const errorIsNotAnonymous: boolean = endEventRaw[BpmnTags.FlowElementProperty.ErrorEventDefinition] !== '';
      let currentError: Model.Types.Error;

      /*
      * If the error is not anonymous, we can look it up in our error definition
      * list. Otherwise, we will declare the error as an anonymous error
      * and attach it to the ErrorEndEvent.
      */
      if (errorIsNotAnonymous) {
        const errorId: string = endEventRaw[BpmnTags.FlowElementProperty.ErrorEventDefinition].errorRef;
        currentError = getErrorForId(errors, errorId);
      } else {

        // Define an anonymous error.
        currentError.errorCode = '';
        currentError.name = '';
      }

      event.errorEventDefinition = new Model.EventDefinitions.ErrorEventDefinition();
      event.errorEventDefinition.errorReference = currentError;
    }
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

  for (const eventRaw of eventsRaw) {
    let event: TEvent = new type();
    event = <TEvent> setCommonObjectPropertiesFromData(eventRaw, event);
    event.name = eventRaw.name;
    event.incoming = getModelPropertyAsArray(eventRaw, BpmnTags.FlowElementProperty.SequenceFlowIncoming);
    event.outgoing = getModelPropertyAsArray(eventRaw, BpmnTags.FlowElementProperty.SequenceFlowOutgoing);

    events.push(event);
  }

  return events;
}

/**
 * Return the error with the given id from the raw error definition data.
 *
 * @param errorList List of all parsed errors
 * @param errorId id of the error
 * @returns Error that matches the given id
 * @throws Error if the end event with the given key was not found.
 */
function getErrorForId(errorList: Array<Model.Types.Error>, errorId: string): Model.Types.Error {
  for (const currentError of errorList) {
    if (currentError.id === errorId) {
      return currentError;
    }
  }
  throw Error(`No error with id ${errorId} found.`);
}
