import * as should from 'should';

import {EventReceivedCallback, Subscription} from '@essential-projects/event_aggregator_contracts';

import {EventAggregatorMock, TimerServiceMock} from '../../mocks';
import {TestFixtureProvider} from '../test_fixture_provider';

describe('TimerFacade.startCycleTimer', (): void => {

  let fixtureProvider: TestFixtureProvider;

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
      timerFacade.startCycleTimer(sampleTimerValue, sampleCallback, sampleEventName);

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
      timerFacade.startCycleTimer(sampleTimerValue, sampleCallback2, sampleEventName);

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
      timerFacade.startCycleTimer(sampleTimerValue, sampleCallback, sampleEventName);

      should(receivedTimerName).be.equal(sampleEventName);
      should(receivedTimerValue).be.equal(sampleTimerValue);
    });
  });

  // TODO: Validation isn't available yet for this UseCase, so for now, Sanity Checks would serve no purpose.
  // See TODO in TimerFacade at Line #126.
  describe('Sanity Checks', (): void => {
  });
});
