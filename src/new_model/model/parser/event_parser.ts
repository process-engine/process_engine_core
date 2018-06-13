import {BpmnTags, Model} from '@process-engine/process_engine_contracts';

import {
  createObjectWithCommonProperties,
  getModelPropertyAsArray,
  setCommonObjectPropertiesFromData,
} from '../type_factory';

export function parseEventsFromProcessData(processData: any): Array<Model.Events.Event> {

  const startEvents: Array<Model.Events.StartEvent>
    = parseEventsByType(processData, BpmnTags.EventElement.StartEvent, Model.Events.StartEvent);

  const endEvents: Array<Model.Events.EndEvent> = parseEndEvents(processData);

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

function parseEndEvents(processData: any) {
  const events: Array<Model.Events.EndEvent> = [];

  const endEventsRaw: Array<any> = getModelPropertyAsArray(processData, BpmnTags.EventElement.EndEvent);

  for (const endEventRaw of endEventsRaw) {

    //TODO: Extend End Event definition type
    const event: any = createObjectWithCommonProperties(endEventRaw, Model.Events.EndEvent);
   
    event.incoming = getModelPropertyAsArray(endEventRaw, BpmnTags.FlowElementProperty.SequenceFlowIncoming);
    event.outgoing = getModelPropertyAsArray(endEventRaw, BpmnTags.FlowElementProperty.SequenceFlowOutgoing);
    event.name = endEventRaw.name;
    
    assignEventDefinition(event, endEventRaw, BpmnTags.FlowElementProperty.ErrorEventDefinition, 'errorEventDefinition');

    if (endEventRaw.hasOwnProperty(BpmnTags.FlowElementProperty.ErrorEventDefinition)) {
      const endEventKey: string = event['errorEventDefinition'].errorRef;
      let errorEventDef: any;

      const errorDefinition = processData[BpmnTags.FlowElementProperty.ErrorEventDefinition];

      if (Array.isArray(errorDefinition)) {
        
        /*
        * Find the error end event which fits to the error end event definition
        * TODO: Refactor this to a new function.
        */
        for (const errorEvent of processData[BpmnTags.FlowElementProperty.ErrorEventDefinition]) {
          if (errorEvent.id === endEventKey) {
            errorEventDef = errorEvent;
            break;
          }
        }

      } else {
        errorEventDef = errorDefinition;
      }

      event['errorEventDefinition'] = errorEventDef;
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
