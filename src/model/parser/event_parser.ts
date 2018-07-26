import {
  BpmnTags,
  Model,
} from '@process-engine/process_engine_contracts';

import {
  createObjectWithCommonProperties,
  getModelPropertyAsArray,
  setCommonObjectPropertiesFromData,
} from '../type_factory';

import {NotFoundError} from '@essential-projects/errors_ts';

export function parseEventsFromProcessData(processData: any, errors: Array<Model.Types.Error>): Array<Model.Events.Event> {

  const startEvents: Array<Model.Events.StartEvent>
    = parseEventsByType(processData, BpmnTags.EventElement.StartEvent, Model.Events.StartEvent);

  const endEvents: Array<Model.Events.EndEvent> = parseEndEvents(processData, errors);

  const boundaryEvents: Array<Model.Events.BoundaryEvent> = parseBoundaryEvents(processData);

  const intermediateThrowEvents: Array<Model.Events.Event> =
    parseEventsByType(processData, BpmnTags.EventElement.IntermediateThrowEvent, Model.Events.IntermediateThrowEvent, true);

  const intermediateCatchEvents: Array<Model.Events.Event> =
    parseEventsByType(processData, BpmnTags.EventElement.IntermediateCatchEvent, Model.Events.IntermediateCatchEvent, true);

  return Array.prototype.concat(startEvents, endEvents, boundaryEvents, intermediateThrowEvents, intermediateCatchEvents);
}

/**
 * Parse all EndEvents of a process.
 * ErrorEndEvents will get their Errors attached to them.
 *
 * @param data Parsed process definition data.
 * @param errors List of process errors.
 * @returns An array of parsed EndEvents.
 */
function parseEndEvents(data: any, errors: Array<Model.Types.Error>): Array<Model.Events.EndEvent> {
  const events: Array<Model.Events.EndEvent> = [];

  const endEventsRaw: any = getModelPropertyAsArray(data, BpmnTags.EventElement.EndEvent);

  for (const endEventRaw of endEventsRaw) {
    const event: Model.Events.EndEvent = createObjectWithCommonProperties(endEventRaw, Model.Events.EndEvent);

    event.name = endEventRaw.name,
    event.incoming = getModelPropertyAsArray(endEventRaw, BpmnTags.FlowElementProperty.SequenceFlowIncoming);
    event.outgoing = getModelPropertyAsArray(endEventRaw, BpmnTags.FlowElementProperty.SequenceFlowOutgoing);

    const eventHasErrorEventDefinition: boolean = endEventRaw.hasOwnProperty(BpmnTags.FlowElementProperty.ErrorEventDefinition);

    if (eventHasErrorEventDefinition) {
      const currentError: Model.Types.Error = ((): Model.Types.Error => {
        const errorIsNotAnonymous: boolean = endEventRaw[BpmnTags.FlowElementProperty.ErrorEventDefinition] !== '';
        if (errorIsNotAnonymous) {
          /*
          * If the error is not anonymous, we can look it up in our error definition
          * list. Otherwise, we will declare the error as an anonymous error
          * and attach it to the ErrorEndEvent.
          */
          const errorId: string = endEventRaw[BpmnTags.FlowElementProperty.ErrorEventDefinition].errorRef;

          return getErrorForId(errors, errorId);
        } else {
          /*
          * An anonymous error should not have any reference or error
          * information.
          *
          * TODO: Find out if we can set the structureRef of the Error Object
          * to undefined here.
          */
          const anonymousStructureRef: Model.TypeReferences.StructureReference = {
            structureId: '',
          };

          return {
            id: '',
            structureRef: anonymousStructureRef,
            errorCode: '',
            name: '',
          };
        }
      })();

      event.errorEventDefinition = new Model.EventDefinitions.ErrorEventDefinition();
      event.errorEventDefinition.errorReference = currentError;
    }
    events.push(event);
  }

  return events;
}

/**
 * Return the error with the given id from the raw error definition data.
 *
 * @param errorList List of all parsed errors.
 * @param errorId ID of the error.
 * @returns Error that matches the given id.
 * @throws Error if the end event with the given id was not found.
 */
function getErrorForId(errorList: Array<Model.Types.Error>, errorId: string): Model.Types.Error {
  for (const currentError of errorList) {
    if (currentError.id === errorId) {
      return currentError;
    }
  }
  throw new NotFoundError(`No error with id ${errorId} found.`);
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

function parseEventsByType<TEvent extends Model.Events.Event>(
  data: any,
  eventType: BpmnTags.EventElement,
  type: Model.Base.IConstructor<TEvent>,
  parseDefinitions: boolean = false,
): Array<TEvent> {

  const events: Array<TEvent> = [];

  const eventsRaw: Array<any> = getModelPropertyAsArray(data, eventType);

  if (!eventsRaw || eventsRaw.length === 0) {
    return [];
  }

  for (const eventRaw of eventsRaw) {
    const event: TEvent = createObjectWithCommonProperties<TEvent>(eventRaw, type);
    event.name = eventRaw.name;
    event.incoming = getModelPropertyAsArray(eventRaw, BpmnTags.FlowElementProperty.SequenceFlowIncoming);
    event.outgoing = getModelPropertyAsArray(eventRaw, BpmnTags.FlowElementProperty.SequenceFlowOutgoing);

    if (parseDefinitions) {
      assignEventDefinitions(event, eventRaw);
    }

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
