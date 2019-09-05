import * as moment from 'moment';
import * as should from 'should';

import {EventReceivedCallback, Subscription} from '@essential-projects/event_aggregator_contracts';

import {TimerFacade} from '../../../src/runtime/facades/timer_facade';
import {EventAggregatorMock, TimerServiceMock} from '../../mocks';
import {TestFixtureProvider} from '../../test_fixture_provider';

describe('TimerFacade.startDateTimer', (): void => {

  let fixtureProvider: TestFixtureProvider;

  const sampleTimerValue = '2100-08-30T11:30:00.000Z';
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
      timerFacade.startDateTimer(sampleTimerValue, sampleCallback, sampleEventName);

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
      timerFacade.startDateTimer(sampleTimerValue, sampleCallback2, sampleEventName);

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
      timerFacade.startDateTimer(sampleTimerValue, sampleCallback, sampleEventName);

      should(receivedTimerName).be.equal(sampleEventName);
      should(receivedMomentObj.toISOString()).be.equal(sampleTimerValue);
    });
  });

  describe('Sanity Checks', (): void => {

    let timerFacade: TimerFacade;

    before((): void => {
      timerFacade = fixtureProvider.createTimerFacade();
    });

    it('Should throw an error, if the provided timer value is invalid', (): void => {
      try {
        timerFacade.startDateTimer('dsfgdfsdfsgd', (): void => {}, 'eventName');
      } catch (error) {
        should(error.message).be.match(/not in ISO8601 format/i);
      }
    });

    it('Should run the provided callback immediately, if the provided value is in the past', (): void => {

      let callbackTriggered = false;

      const timerValue = moment()
        .subtract(1, 'day')
        .toISOString();

      const sampleCallback2 = (): any => {
        callbackTriggered = true;
      };

      timerFacade.startDateTimer(timerValue, sampleCallback2, 'eventName');

      should(callbackTriggered).be.true();
    });

    it('Should throw an error, if no callback is provided', (): void => {
      try {
        timerFacade.startDateTimer(sampleTimerValue, undefined, 'eventName');
      } catch (error) {
        should(error.message).be.match(/must provide a callback/i);
      }
    });
  });
});
