import * as should from 'should';

import {TestFixtureProvider} from '../../test_fixture_provider';

describe('SubSubProcessModelFacade.getStartEvents', (): void => {

  let fixtureProvider: TestFixtureProvider;

  before(async (): Promise<void> => {
    fixtureProvider = new TestFixtureProvider();
    await fixtureProvider.initialize();
  });

  it('Should return one StartEvent for a Subprocess that only has one.', async (): Promise<void> => {

    const subProcessModelFacade = await fixtureProvider.createSubProcessModelFacade();

    const expectedStartEventId = 'StartEvent_SubProcess';

    const startEvents = subProcessModelFacade.getStartEvents();

    should(startEvents).be.instanceOf(Array);
    should(startEvents.length).be.equal(1);
    should(startEvents[0].id).be.equal(expectedStartEventId);
  });

  it('Should return all StartEvents from a Subprocess with multiple StartEvents.', async (): Promise<void> => {

    const subProcessModelFacade = await fixtureProvider.createSubProcessModelFacade('subprocess_2_test.bpmn');

    const expectedStartEventIds = [
      'StartEvent_SubProcess',
      'StartEvent_2_SubProcess',
    ];

    const startEvents = subProcessModelFacade.getStartEvents();

    should(startEvents).be.instanceOf(Array);
    should(startEvents.length).be.equal(2);

    for (const expectedId of expectedStartEventIds) {
      const startEventExists = startEvents.some((startEvent): boolean => startEvent.id === expectedId);
      should(startEventExists).be.true(`The StartEventList should have contained an event with ID '${expectedId}', but none was found!`);
    }
  });
});
