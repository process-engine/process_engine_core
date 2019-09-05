import * as should from 'should';

import {Subscription} from '@essential-projects/event_aggregator_contracts';

import {EventAggregatorMock, TimerServiceMock} from '../../mocks';
import {TestFixtureProvider} from '../../test_fixture_provider';

describe('TimerFacade.cancel', (): void => {

  let fixtureProvider: TestFixtureProvider;

  before(async (): Promise<void> => {
    fixtureProvider = new TestFixtureProvider();
    await fixtureProvider.initialize();
  });

  describe('Execution', (): void => {

    it('Should unsubscribe from the EventAggregator.', async (): Promise<void> => {

      return new Promise((resolve, reject): void => {

        const sampleSubscription = new Subscription('sampleId', 'eventName');

        const eventAggregatorMock = new EventAggregatorMock();
        eventAggregatorMock.unsubscribe = (subscription: Subscription): void => {
          should(subscription).be.eql(sampleSubscription);
          resolve();
        };

        const timerFacade = fixtureProvider.createTimerFacade(eventAggregatorMock);

        timerFacade.cancelTimerSubscription(sampleSubscription);
      });
    });

    it('Should unsubscribe from the TimerService.', async (): Promise<void> => {

      return new Promise((resolve, reject): void => {

        const sampleSubscription = new Subscription('sampleId', 'eventName');

        const timerServiceMock = new TimerServiceMock();
        timerServiceMock.cancel = (timerId: string): void => {
          // Note: Can't test the timerId, because we cannot access the internal timerStorage,
          // without doing a lot more stuff than this test is supposed to cover.
          resolve();
        };

        const timerFacade = fixtureProvider.createTimerFacade(undefined, timerServiceMock);

        timerFacade.cancelTimerSubscription(sampleSubscription);
      });
    });
  });

  describe('Sanity Checks', (): void => {

    it('Should not throw an error, if the given subscription does not exist', (): void => {

      const timerFacade = fixtureProvider.createTimerFacade();

      const sampleSubscription = new Subscription('someNonExistingSampleId', 'eventName');
      timerFacade.cancelTimerSubscription(sampleSubscription);
    });

    it('Should throw an error, if no Subscription is provided', (): void => {
      try {
        const timerFacade = fixtureProvider.createTimerFacade();
        timerFacade.cancelTimerSubscription(undefined);
        should.fail('result', undefined, 'This should have failed, because "subscription" is required!');
      } catch (error) {
        should(error).be.instanceOf(Error);
      }
    });
  });
});
