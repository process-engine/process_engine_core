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
