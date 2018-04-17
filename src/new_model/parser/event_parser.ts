import {BpmnTags, Model} from '@process-engine/process_engine_contracts';

import {
  createObjectWithCommonProperties,
  getModelPropertyAsArray,
  setCommonObjectPropertiesFromData,
} from '../type_factory';

export function parseEventsFromProcessData(processData: any): Array<Model.Events.Event> {

  const startEvents: Array<Model.Events.StartEvent>
    = parseEventsByType(processData, BpmnTags.EventElement.StartEvent, Model.Events.StartEvent);

  const endEvents: Array<Model.Events.EndEvent>
    = parseEventsByType(processData, BpmnTags.EventElement.EndEvent, Model.Events.EndEvent);

  const boundaryEvents: Array<Model.Events.BoundaryEvent> = parseBoundaryEvents(processData);

  return Array.prototype.concat(startEvents, boundaryEvents, endEvents);
}

function parseBoundaryEvents(processData: any): Array<Model.Events.BoundaryEvent> {

  const events: Array<Model.Events.BoundaryEvent> = [];

  const eventsRaw: Array<Model.Events.BoundaryEvent> = getModelPropertyAsArray(processData, BpmnTags.EventElement.Boundary);

  if (!eventsRaw || eventsRaw.length === 0) {
    return [];
  }

  eventsRaw.forEach((boundaryEventRaw: any): void => {
    const event: Model.Events.BoundaryEvent = createObjectWithCommonProperties(boundaryEventRaw, Model.Events.BoundaryEvent);

    event.incoming = getModelPropertyAsArray(boundaryEventRaw, BpmnTags.FlowElementProperty.SequenceFlowIncoming);
    event.outgoing = getModelPropertyAsArray(boundaryEventRaw, BpmnTags.FlowElementProperty.SequenceFlowOutgoing);

    event.name = boundaryEventRaw.name;
    event.attachedToRef = boundaryEventRaw.attachedToRef;
    event.cancelActivity = boundaryEventRaw.cancelActivity || true;
    event.errorEventDefinition = boundaryEventRaw[BpmnTags.FlowElementProperty.ErrorEventDefinition];

    events.push(event);
  });

  return events;
}

function parseEventsByType<TEvent extends Model.Events.Event>(
  data: any,
  eventType: BpmnTags.EventElement,
  type: Model.Base.IConstructor<TEvent>,
): Array<TEvent> {

  const events: Array<TEvent> = [];

  const eventsRaw: Array<TEvent> = getModelPropertyAsArray(data, eventType);

  if (!eventsRaw || eventsRaw.length === 0) {
    return [];
  }

  eventsRaw.forEach((eventRaw: any): void => {
    let event: TEvent = new type();
    event = <TEvent> setCommonObjectPropertiesFromData(eventRaw, event);
    event.name = eventRaw.name;
    event.incoming = getModelPropertyAsArray(eventRaw, BpmnTags.FlowElementProperty.SequenceFlowIncoming);
    event.outgoing = getModelPropertyAsArray(eventRaw, BpmnTags.FlowElementProperty.SequenceFlowOutgoing);

    events.push(event);
  });

  return events;
}

function getEventDefinitionsForEvent(event: Model.Events.Event, modelData: any): Model.Events.Event {

  if (modelData[BpmnTags.FlowElementProperty.ErrorEventDefinition]) {
    const errorEventDefinition: Model.EventDefinitions.ErrorEventDefinition = new Model.EventDefinitions.ErrorEventDefinition();
    errorEventDefinition.errorReference = modelData[BpmnTags.FlowElementProperty.ErrorEventDefinition].errorRef;

    event.errorEventDefinition = errorEventDefinition;
  }

  if (modelData[BpmnTags.FlowElementProperty.MessageEventDefinition]) {
    const messageEventDefinition: Model.EventDefinitions.MessageEventDefinition = new Model.EventDefinitions.MessageEventDefinition();
    messageEventDefinition.messageReference = modelData[BpmnTags.FlowElementProperty.MessageEventDefinition].messageRef;

    event.messageEventDefinition = messageEventDefinition;
  }

  if (modelData[BpmnTags.FlowElementProperty.SignalEventDefinition]) {
    const signalEventDefinition: Model.EventDefinitions.SignalEventDefinition = new Model.EventDefinitions.SignalEventDefinition();
    signalEventDefinition.signalReference = modelData[BpmnTags.FlowElementProperty.SignalEventDefinition].signalRef;

    event.signalEventDefinition = signalEventDefinition;
  }

  if (modelData[BpmnTags.FlowElementProperty.TerminateEventDefinition]) {
    const terminateEventDefinition: Model.EventDefinitions.TerminateEventDefinition = new Model.EventDefinitions.TerminateEventDefinition();

    event.terminateEventDefinition = terminateEventDefinition;
  }

  // TODO: TimingEvents are declared as IntermediateCatchEvents, wich are not implemented yet.

  return event;
}
