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
    const event: Model.Events.IntermediateCatchEvent = createObjectWithCommonProperties(intermediateCatchEventRaw, Model.Events.IntermediateCatchEvent);

    event.incoming = getModelPropertyAsArray(intermediateCatchEventRaw, BpmnTags.FlowElementProperty.SequenceFlowIncoming);
    event.outgoing = getModelPropertyAsArray(intermediateCatchEventRaw, BpmnTags.FlowElementProperty.SequenceFlowOutgoing);

    event.name = intermediateCatchEventRaw.name;
    event.errorEventDefinition = intermediateCatchEventRaw[BpmnTags.FlowElementProperty.ErrorEventDefinition];
    event.timerEventDefinition = intermediateCatchEventRaw[BpmnTags.FlowElementProperty.TimerEventDefinition];
    event.terminateEventDefinition = intermediateCatchEventRaw[BpmnTags.FlowElementProperty.TerminateEventDefinition];
    event.messageEventDefinition = intermediateCatchEventRaw[BpmnTags.FlowElementProperty.MessageEventDefinition];
    event.signalEventDefinition = intermediateCatchEventRaw[BpmnTags.FlowElementProperty.SignalEventDefinition];

    events.push(event);
  }

  return events;
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
    event.errorEventDefinition = boundaryEventRaw[BpmnTags.FlowElementProperty.ErrorEventDefinition];

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
