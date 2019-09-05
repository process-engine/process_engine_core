import * as should from 'should';

import {BpmnType} from '@process-engine/process_engine_contracts';
import {EventReceivedCallback, Subscription} from '@essential-projects/event_aggregator_contracts';

import {TimerFacade} from '../../../src/runtime/facades/timer_facade';

import {EventAggregatorMock, TimerServiceMock} from '../../mocks';
import {TestFixtureProvider} from '../../test_fixture_provider';

describe('TimerFacade.startCycleTimer', (): void => {

  let fixtureProvider: TestFixtureProvider;

  const sampleFlowNode = {
    bpmnType: BpmnType.startEvent,
  };
  const sampleTimerValue = '* 2 * * *';
  const sampleEventName = 'TimerExpiredEventName';
  const sampleCallback = (payload: any): any => {};

  before(async (): Promise<void> => {
    fixtureProvider = new TestFixtureProvider();
    await fixtureProvider.initialize();
  });

  describe('Execution', (): void => {

    it('Should create a subscription on the EventAggregator', (): void => {

      let receivedEventName;
      let receivedCallback;

      const eventAggregatorMock = new EventAggregatorMock();
      eventAggregatorMock.subscribe = (eventName: string, callback: EventReceivedCallback): Subscription => {
        receivedEventName = eventName;
        receivedCallback = callback;

        return new Subscription('hello', eventName);
      };

      const timerFacade = fixtureProvider.createTimerFacade(eventAggregatorMock);
      timerFacade.startCycleTimer(sampleTimerValue, sampleFlowNode as any, sampleCallback, sampleEventName);

      should(receivedEventName).be.equal(sampleEventName);
      should(receivedCallback).be.a.Function();
    });

    it('Should make use of the provided callback, when subscribing to the EventAggregator', (): void => {

      let payloadReceivedThroughCallback: any;
      const sampleCallback2 = (payload: any): any => {
        payloadReceivedThroughCallback = payload;
      };

      let receivedCallback: EventReceivedCallback;

      const eventAggregatorMock = new EventAggregatorMock();
      eventAggregatorMock.subscribe = (eventName: string, callback: EventReceivedCallback): Subscription => {
        receivedCallback = callback;
        return new Subscription('hello', eventName);
      };

      const timerFacade = fixtureProvider.createTimerFacade(eventAggregatorMock);
      timerFacade.startCycleTimer(sampleTimerValue, sampleFlowNode as any, sampleCallback2, sampleEventName);

      const sampleEventTriggerPayload = {
        hello: 'world',
      };

      receivedCallback(sampleEventTriggerPayload);

      should(payloadReceivedThroughCallback).be.eql(sampleEventTriggerPayload);
    });

    it('Should create a job on the TimerService', (): void => {

      let receivedTimerName: string;
      let receivedTimerValue: string;

      const eventAggregatorMock = new EventAggregatorMock();
      eventAggregatorMock.subscribe = (eventName: string, callback: EventReceivedCallback): Subscription => {
        return new Subscription('hello', eventName);
      };

      const timerServiceMock = new TimerServiceMock();
      timerServiceMock.cronjob = (crontab: string, timerName: string): any => {
        receivedTimerName = timerName;
        receivedTimerValue = crontab;
      };

      const timerFacade = fixtureProvider.createTimerFacade(eventAggregatorMock, timerServiceMock);
      timerFacade.startCycleTimer(sampleTimerValue, sampleFlowNode as any, sampleCallback, sampleEventName);

      should(receivedTimerName).be.equal(sampleEventName);
      should(receivedTimerValue).be.equal(sampleTimerValue);
    });
  });

  describe('Sanity Checks', (): void => {

    let timerFacade: TimerFacade;

    before((): void => {
      timerFacade = fixtureProvider.createTimerFacade();
    });

    it('Should throw an error, if the provided crontab is invalid', (): void => {
      try {
        timerFacade.startCycleTimer('dsfgdfsdfsgd', sampleFlowNode as any, (): void => {}, 'eventName');
      } catch (error) {
        should(error.message).be.match(/ not a valid crontab/i);
      }
    });

    it('Should throw an error, if no FlowNode is provided', (): void => {
      try {
        timerFacade.startCycleTimer('* * 2 * *', undefined, (): void => {}, 'eventName');
      } catch (error) {
        should(error).be.instanceOf(Error);
      }
    });

    it('Should throw an error, if the FlowNode is not a StartEvent', (): void => {
      try {
        const invalidFlowNode = {
          bpmnType: BpmnType.intermediateCatchEvent,
        };

        timerFacade.startCycleTimer('* * 2 * *', invalidFlowNode as any, (): void => {}, 'eventName');
      } catch (error) {
        should(error.message).be.match(/only allowed for TimerStartEvents/i);
      }
    });

    it('Should throw an error, if no callback is provided', (): void => {
      try {
        timerFacade.startCycleTimer('* * 2 * *', sampleFlowNode as any, undefined, 'eventName');
      } catch (error) {
        should(error.message).be.match(/must provide a callback/i);
      }
    });

  });
});
