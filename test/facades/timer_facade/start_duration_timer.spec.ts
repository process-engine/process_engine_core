import * as moment from 'moment';
import * as should from 'should';

import {EventReceivedCallback, Subscription} from '@essential-projects/event_aggregator_contracts';

import {TimerFacade} from '../../../src/runtime/facades/timer_facade';
import {EventAggregatorMock, TimerServiceMock} from '../../mocks';
import {TestFixtureProvider} from '../../test_fixture_provider';

describe('TimerFacade.startDurationTimer', (): void => {

  let fixtureProvider: TestFixtureProvider;

  const sampleTimerValue = 'P0Y0M0DT0H0M2S';
  const sampleEventName = 'TimerExpiredEventName';
  const sampleCallback = (payload: any): any => {};

  before(async (): Promise<void> => {
    fixtureProvider = new TestFixtureProvider();
    await fixtureProvider.initialize();
  });

  describe('Execution', (): void => {

    it('Should create a subscription on the EventAggregator', (): void => {

      let receivedEventName: string;
      let receivedCallback: EventReceivedCallback;

      const eventAggregatorMock = new EventAggregatorMock();
      eventAggregatorMock.subscribeOnce = (eventName: string, callback: EventReceivedCallback): Subscription => {
        receivedEventName = eventName;
        receivedCallback = callback;

        return new Subscription('hello', eventName);
      };

      const timerFacade = fixtureProvider.createTimerFacade(eventAggregatorMock);
      timerFacade.startDurationTimer(sampleTimerValue, sampleCallback, sampleEventName);

      should(receivedEventName).be.equal(sampleEventName);
      should(receivedCallback).be.a.Function();
    });

    it('Should make use of the provided callback, when subscribing to the EventAggregator', (): void => {

      let payloadReceivedThroughCallback;
      const sampleCallback2 = (payload: any): any => {
        payloadReceivedThroughCallback = payload;
      };

      let receivedCallback: EventReceivedCallback;

      const eventAggregatorMock = new EventAggregatorMock();
      eventAggregatorMock.subscribeOnce = (eventName: string, callback: EventReceivedCallback): Subscription => {
        receivedCallback = callback;
        return new Subscription('hello', eventName);
      };

      const timerFacade = fixtureProvider.createTimerFacade(eventAggregatorMock);
      timerFacade.startDurationTimer(sampleTimerValue, sampleCallback2, sampleEventName);

      const sampleEventTriggerPayload = {
        hello: 'world',
      };

      receivedCallback(sampleEventTriggerPayload);

      should(payloadReceivedThroughCallback).be.eql(sampleEventTriggerPayload);
    });

    it('Should create a job on the TimerService', (): void => {

      let receivedTimerName: string;
      let receivedMomentObj: moment.Moment;

      const eventAggregatorMock = new EventAggregatorMock();
      eventAggregatorMock.subscribeOnce = (eventName: string, callback: EventReceivedCallback): Subscription => {
        return new Subscription('hello', eventName);
      };

      const timerServiceMock = new TimerServiceMock();
      timerServiceMock.oneShot = (momentObj: moment.Moment, timerName: string): any => {
        receivedTimerName = timerName;
        receivedMomentObj = momentObj;
      };

      const timerFacade = fixtureProvider.createTimerFacade(eventAggregatorMock, timerServiceMock);
      timerFacade.startDurationTimer(sampleTimerValue, sampleCallback, sampleEventName);

      const sampleTimerValueAsDuration = moment.duration(sampleTimerValue);
      const expectedDate = moment().add(sampleTimerValueAsDuration);

      should(receivedTimerName).be.equal(sampleEventName);
      should(receivedMomentObj.format('YYYY-MM-DD HH:mm:ss')).be.equal(expectedDate.format('YYYY-MM-DD HH:mm:ss'));
    });
  });

  describe('Sanity Checks', (): void => {

    let timerFacade: TimerFacade;

    before((): void => {
      timerFacade = fixtureProvider.createTimerFacade();
    });

    it('Should throw an error, if the provided timer value is invalid', (): void => {
      try {
        timerFacade.startDurationTimer('dsfgdfsdfsgd', (): void => {}, 'eventName');
      } catch (error) {
        should(error.message).be.match(/not in ISO8601 format/i);
      }
    });

    it('Should throw an error, if no callback is provided', (): void => {
      try {
        timerFacade.startDurationTimer(sampleTimerValue, undefined, 'eventName');
      } catch (error) {
        should(error.message).be.match(/must provide a callback/i);
      }
    });
  });
});
