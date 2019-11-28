import * as clone from 'clone';
import * as should from 'should';

import {UnprocessableEntityError} from '@essential-projects/errors_ts';

import {EventType, Model} from '@process-engine/persistence_api.contracts';

import {parseEventsFromProcessData} from '../../../src/model/parser/flow_node_parsers/event_parser';

import * as SampleData from './sample_data';

describe('EventParser.parseEventsFromProcessData', (): void => {

  const sampleEvents = [{
    id: 'Message_1',
    name: 'Message 1',
  }, {
    id: 'Message_2',
    name: 'Message 2',
  }, {
    id: 'Message_3',
    name: 'Message 3',
  }, {
    id: 'Signal_1',
    name: 'Signal 1',
  }, {
    id: 'Signal_2',
    name: 'Signal 2',
  }, {
    id: 'Signal_3',
    name: 'Signal 3',
  }];

  const sampleErrors = [{
    id: 'Error_1',
    code: '',
    name: '',
    message: '',
  }, {
    id: 'Error_2',
    code: '',
    name: '',
    message: '',
  }];

  describe('Saniy Checks', (): void => {

    it('Should throw an error, if a given event contains more than one type of EventDefinition', (): void => {

      try {
        const result = parseEventsFromProcessData(SampleData.misconfiguredEvents, [], []);
        should.fail(result, 'Error', 'This should have caused an error, because some of the events point to non-existing messages and signals!');
      } catch (error) {
        should(error).be.an.instanceOf(UnprocessableEntityError);
        should(error.message).match(/event.*?has more than one type of event definition/i);
        should(error).have.a.property('additionalInformation');
        should(error.additionalInformation).have.a.property('eventObject');
        should(error.additionalInformation).have.a.property('rawEventData');
      }
    });
  });

  describe('StartEvent', (): void => {

    it('Should correctly parse a list of StartEvents of varying type', (): void => {

      const result = <Array<Model.Events.StartEvent>> parseEventsFromProcessData(SampleData.sampleStartEvents, sampleErrors, sampleEvents);

      should(result).be.an.Array();
      should(result).be.length(7);

      const messageEvents = result.filter((value): boolean => value.eventType === EventType.messageEvent);
      const regularEvents = result.filter((value): boolean => value.eventType === undefined);
      const signalEvents = result.filter((value): boolean => value.eventType === EventType.signalEvent);
      const timerEvents = result.filter((value): boolean => value.eventType === EventType.timerEvent);

      should(messageEvents).have.a.lengthOf(2);
      should(regularEvents).have.a.lengthOf(1);
      should(signalEvents).have.a.lengthOf(1);
      should(timerEvents).have.a.lengthOf(3);

      messageEvents.forEach(assertMessageEvent);
      regularEvents.forEach(assertRegularEvent);
      signalEvents.forEach(assertSignalEvent);
      timerEvents.forEach(assertTimerEvent);
    });

    it('Should not throw an error, if any of the given StartEvents uses an invalid timer definition.', (): void => {
      const sampleFlowNode = SampleData.sampleStartEvents['bpmn:startEvent'].find((entry): boolean => entry.id === 'TimerStartEvent_1');

      const sampleCopy = clone(sampleFlowNode);
      sampleCopy['bpmn:timerEventDefinition'] = {} as any;

      const samplePayload = {
        'bpmn:startEvent': [sampleCopy],
      };

      const result = parseEventsFromProcessData(samplePayload, [], sampleEvents);

      should(result).be.an.Array();
      should(result).be.length(1);
    });

    it('Should not throw an error, if any of the given StartEvents have invalid event references', (): void => {
      const result = parseEventsFromProcessData(SampleData.sampleStartEvents, [], []);

      should(result).be.an.Array();
      should(result).be.length(7);
    });

  });

  describe('EndEvents', (): void => {

    it('Should correctly parse a list of EndEvents of varying type', (): void => {

      const result = <Array<Model.Events.EndEvent>> parseEventsFromProcessData(SampleData.sampleEndEvents, sampleErrors, sampleEvents);

      should(result).be.an.Array();
      should(result).be.length(8);

      const errorEvents = result.filter((value): boolean => value.eventType === EventType.errorEvent);
      const messageEvents = result.filter((value): boolean => value.eventType === EventType.messageEvent);
      const regularEvents = result.filter((value): boolean => value.eventType === undefined);
      const signalEvents = result.filter((value): boolean => value.eventType === EventType.signalEvent);
      const terminateEvents = result.filter((value): boolean => value.eventType === EventType.terminateEvent);

      should(errorEvents).have.a.lengthOf(2);
      should(messageEvents).have.a.lengthOf(3);
      should(regularEvents).have.a.lengthOf(1);
      should(signalEvents).have.a.lengthOf(1);
      should(terminateEvents).have.a.lengthOf(1);

      errorEvents.forEach(assertErrorEvent);
      messageEvents.forEach(assertMessageEvent);
      regularEvents.forEach(assertRegularEvent);
      signalEvents.forEach(assertSignalEvent);
      terminateEvents.forEach(assertTerminateEvent);
    });

    it('Should correctly parse a list of EndEvents that have inputValues attached to them', (): void => {

      const result = <Array<Model.Events.EndEvent>> parseEventsFromProcessData(SampleData.sampleEndEventsWithInputValues, sampleErrors, sampleEvents);

      should(result).be.an.Array();
      should(result).be.length(3);

      const eventWithString = result.find((value): boolean => value.id === 'Event_1');
      const eventWithArray = result.find((value): boolean => value.id === 'Event_2');
      const eventWithNothing = result.find((value): boolean => value.id === 'Event_3');

      const expectedStringInputValues = 'value';
      const expectedArrayInputValues = ['value1', 'value2', 'value3'];

      should(eventWithString.inputValues).be.eql(expectedStringInputValues);
      should(eventWithArray.inputValues).be.eql(expectedArrayInputValues);
      should.not.exist(eventWithNothing.inputValues);
    });

    it('Should not throw an error, if any of the EndEvents has a definition that points to a non-existing message or signal', (): void => {
      const result = parseEventsFromProcessData(SampleData.sampleEndEvents, sampleErrors, []);

      should(result).be.an.Array();
      should(result).be.length(8);
    });

    it('Should throw an error, if any of the EndEvents has an ErrorDefinition that points to a non-existing error', (): void => {

      try {
        const result = parseEventsFromProcessData(SampleData.sampleEndEvents, [], sampleEvents);
        should.fail(result, 'Error', 'This should have caused an error, because one of the events uses an invalid error definition!');
      } catch (error) {
        should(error).be.an.instanceOf(UnprocessableEntityError);
        should(error.message).be.a.match(/reference.*?on event.*?is invalid/i);
      }
    });

  });

  describe('BoundaryEvents', (): void => {

    it('Should correctly parse a list of BoundaryEvents of varying type', (): void => {

      const result = <Array<Model.Events.BoundaryEvent>> parseEventsFromProcessData(SampleData.sampleBoundaryEvents, sampleErrors, sampleEvents);

      should(result).be.an.Array();
      should(result).be.length(7);

      const errorEvents = result.filter((value): boolean => value.eventType === EventType.errorEvent);
      const messageEvents = result.filter((value): boolean => value.eventType === EventType.messageEvent);
      const signalEvents = result.filter((value): boolean => value.eventType === EventType.signalEvent);
      const timerEvents = result.filter((value): boolean => value.eventType === EventType.timerEvent);

      should(errorEvents).have.a.lengthOf(1);
      should(messageEvents).have.a.lengthOf(1);
      should(signalEvents).have.a.lengthOf(2);
      should(timerEvents).have.a.lengthOf(3);

      errorEvents.forEach(assertErrorEvent);
      messageEvents.forEach(assertMessageEvent);
      signalEvents.forEach(assertSignalEvent);
      timerEvents.forEach(assertTimerEvent);
    });

    it('Should not throw an error, if any of the BoundaryEvents uses an invalid timer definition.', (): void => {
      const sampleFlowNode = SampleData.sampleBoundaryEvents['bpmn:boundaryEvent'].find((entry): boolean => entry.id === 'TimerBoundaryEvent_1');

      const sampleCopy = clone(sampleFlowNode);
      sampleCopy['bpmn:timerEventDefinition'] = {} as any;

      const samplePayload = {
        'bpmn:boundaryEvent': [sampleCopy],
      };

      const result = parseEventsFromProcessData(samplePayload, [], sampleEvents);

      should(result).be.an.Array();
      should(result).be.length(1);
    });

    it('Should not throw an error, if any of the BoundaryEvents has a definition that points to a non-existing message or signal', (): void => {
      const result = parseEventsFromProcessData(SampleData.sampleBoundaryEvents, sampleErrors, []);

      should(result).be.an.Array();
      should(result).be.length(7);
    });

    it('Should throw an error, if any of the BoundaryEvents has an ErrorDefinition that points to a non-existing error', (): void => {

      try {
        const result = parseEventsFromProcessData(SampleData.sampleBoundaryEvents, [], sampleEvents);
        should.fail(result, 'Error', 'This should have caused an error, because one of the events uses an invalid error definition!');
      } catch (error) {
        should(error).be.an.instanceOf(UnprocessableEntityError);
        should(error.message).be.a.match(/reference.*?on event.*?is invalid/i);
        should(error).have.a.property('additionalInformation');
        should(error.additionalInformation).have.a.property('eventObject');
        should(error.additionalInformation).have.a.property('rawEventData');
      }
    });

    it('Should throw an error, if a BoundaryEvent contains a cyclic timer, which is not allowed', (): void => {
      try {
        const result = parseEventsFromProcessData(SampleData.boundaryEventsWithCyclicTimers, [], sampleEvents);
        should.fail(result, 'Error', 'This should have caused an error, because cyclic timers are not allowed in BoundaryEvents!');
      } catch (error) {
        should(error).be.an.instanceOf(UnprocessableEntityError);
        should(error.message).be.a.match(/Using cyclic timers for BoundaryEvents is not allowed/i);
      }
    });

  });

  describe('IntermediateCatchEvents', (): void => {

    it('Should correctly parse a list of IntermediateCatchEvents of varying type', (): void => {

      const result = <Array<Model.Events.IntermediateCatchEvent>>
        parseEventsFromProcessData(SampleData.sampleIntermediateCatchEvents, [], sampleEvents);

      should(result).be.an.Array();
      should(result).be.length(7);

      const linkEvents = result.filter((value): boolean => value.eventType === EventType.linkEvent);
      const messageEvents = result.filter((value): boolean => value.eventType === EventType.messageEvent);
      const signalEvents = result.filter((value): boolean => value.eventType === EventType.signalEvent);
      const timerEvents = result.filter((value): boolean => value.eventType === EventType.timerEvent);

      should(linkEvents).have.a.lengthOf(2);
      should(messageEvents).have.a.lengthOf(1);
      should(signalEvents).have.a.lengthOf(3);
      should(timerEvents).have.a.lengthOf(1);

      linkEvents.forEach(assertLinkEvent);
      messageEvents.forEach(assertMessageEvent);
      signalEvents.forEach(assertSignalEvent);
      timerEvents.forEach(assertTimerEvent);
    });

    it('Should not throw an error, if any of the IntermediateCatchEvents uses an invalid timer definition.', (): void => {
      const sampleFlowNode = SampleData
        .sampleIntermediateCatchEvents['bpmn:intermediateCatchEvent']
        .find((entry): boolean => entry.id === 'TimerCatchEvent_1');

      const sampleCopy = clone(sampleFlowNode);
      sampleCopy['bpmn:timerEventDefinition'] = {} as any;

      const samplePayload = {
        'bpmn:intermediateCatchEvent': [sampleCopy],
      };

      const result = parseEventsFromProcessData(samplePayload, [], sampleEvents);

      should(result).be.an.Array();
      should(result).be.length(1);
    });

    // eslint-disable-next-line max-len
    it('Should not throw an error, if any of the IntermediateCatchEvents has a definition that points to a non-existing message or signal', (): void => {
      const result = parseEventsFromProcessData(SampleData.sampleIntermediateCatchEvents, [], []);

      should(result).be.an.Array();
      should(result).be.length(7);
    });

  });

  describe('IntermediateThrowEvents', (): void => {

    it('Should correctly parse a list of IntermediateThrowEvents of varying type', (): void => {

      const result = <Array<Model.Events.IntermediateThrowEvent>>
        parseEventsFromProcessData(SampleData.sampleIntermediateThrowEvents, [], sampleEvents);

      should(result).be.an.Array();
      should(result).be.length(7);

      const linkEvents = result.filter((value): boolean => value.eventType === EventType.linkEvent);
      const messageEvents = result.filter((value): boolean => value.eventType === EventType.messageEvent);
      const signalEvents = result.filter((value): boolean => value.eventType === EventType.signalEvent);

      should(linkEvents).have.a.lengthOf(3);
      should(messageEvents).have.a.lengthOf(2);
      should(signalEvents).have.a.lengthOf(2);

      linkEvents.forEach(assertLinkEvent);
      messageEvents.forEach(assertMessageEvent);
      signalEvents.forEach(assertSignalEvent);
    });

    // eslint-disable-next-line max-len
    it('Should not throw an error, if any of the IntermediateThrowEvents has a definition that points to a non-existing message or signal', (): void => {
      const result = parseEventsFromProcessData(SampleData.sampleIntermediateThrowEvents, [], []);

      should(result).be.an.Array();
      should(result).be.length(7);
    });
  });

  function assertRegularEvent(event: Model.Events.Event): void {
    should(event).have.property('id');
    should(event).have.property('name');
    should(event).have.property('bpmnType');
    should(event).have.property('eventType');
  }

  function assertErrorEvent(event: Model.Events.Event): void {
    should(event).have.property('id');
    should(event).have.property('name');
    should(event).have.property('bpmnType');
    should(event).have.property('errorEventDefinition');
    should(event).have.property('eventType');
    should((event as any).eventType).be.equal(EventType.errorEvent); // TODO: The base event should expose a property "eventType".

    const errorEventDefinition = (event as any).errorEventDefinition;

    should(errorEventDefinition).have.property('id');
    should(errorEventDefinition).have.property('code');
    should(errorEventDefinition).have.property('name');
    should(errorEventDefinition).have.property('message');
  }

  function assertLinkEvent(event: Model.Events.Event): void {
    should(event).have.property('id');
    should(event).have.property('name');
    should(event).have.property('bpmnType');
    should(event).have.property('linkEventDefinition');
    should(event).have.property('eventType');
    should((event as any).eventType).be.equal(EventType.linkEvent);

    const linkEventDefinition = (event as any).linkEventDefinition;

    should(linkEventDefinition).have.property('name');
    should(linkEventDefinition.name.length).be.greaterThan(0);
  }

  function assertMessageEvent(event: Model.Events.Event): void {
    should(event).have.property('id');
    should(event).have.property('name');
    should(event).have.property('bpmnType');
    should(event).have.property('messageEventDefinition');
    should(event).have.property('eventType');
    should((event as any).eventType).be.equal(EventType.messageEvent);

    const messageEventDefinition = (event as any).messageEventDefinition;

    should(messageEventDefinition).have.property('id');
    should(messageEventDefinition).have.property('name');
    should(messageEventDefinition.id.length).be.greaterThan(0);
  }

  function assertSignalEvent(event: Model.Events.Event): void {
    should(event).have.property('id');
    should(event).have.property('name');
    should(event).have.property('bpmnType');
    should(event).have.property('signalEventDefinition');
    should(event).have.property('eventType');
    should((event as any).eventType).be.equal(EventType.signalEvent);

    const signalEventDefinition = (event as any).signalEventDefinition;

    should(signalEventDefinition).have.property('id');
    should(signalEventDefinition).have.property('name');
    should(signalEventDefinition.id.length).be.greaterThan(0);
  }

  function assertTimerEvent(event: Model.Events.Event): void {
    should(event).have.property('id');
    should(event).have.property('name');
    should(event).have.property('bpmnType');
    should(event).have.property('timerEventDefinition');
    should(event).have.property('eventType');
    should((event as any).eventType).be.equal(EventType.timerEvent);

    const timerEventDefinition = (event as any).timerEventDefinition;

    should(timerEventDefinition).have.property('enabled');
    should(timerEventDefinition).have.property('timerType');
    should(timerEventDefinition).have.property('value');
    should(timerEventDefinition.enabled).be.a.Boolean();
    should(timerEventDefinition.value.length).be.greaterThan(0);
  }

  function assertTerminateEvent(event: Model.Events.Event): void {
    should(event).have.property('id');
    should(event).have.property('name');
    should(event).have.property('bpmnType');
    should(event).have.property('terminateEventDefinition');
    should(event).have.property('eventType');
    should((event as any).eventType).be.equal(EventType.terminateEvent);
  }
});
