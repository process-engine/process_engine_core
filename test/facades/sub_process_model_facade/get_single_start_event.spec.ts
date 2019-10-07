import * as should from 'should';

import {Model} from '@process-engine/persistence_api.contracts';

import {TestFixtureProvider} from '../../test_fixture_provider';

describe('SubProcessModelFacade.getSingleStartEvent', (): void => {

  let fixtureProvider: TestFixtureProvider;

  before(async (): Promise<void> => {
    fixtureProvider = new TestFixtureProvider();
    await fixtureProvider.initialize();
  });

  it('Should return the single StartEvent for a Subprocess that only has one.', async (): Promise<void> => {

    const subProcessModelFacade = await fixtureProvider.createSubProcessModelFacade();

    const expectedStartEventId = 'StartEvent_SubProcess';

    const startEvent = subProcessModelFacade.getSingleStartEvent();

    should(startEvent).be.instanceOf(Model.Events.StartEvent);
    should(startEvent.id).be.equal(expectedStartEventId);
  });

  it('Should pick the first StartEvent from a ProcessModel with multiple StartEvents.', async (): Promise<void> => {

    const subProcessModelFacade = await fixtureProvider.createSubProcessModelFacade('subprocess_2_test.bpmn');

    const expectedStartEventId = 'StartEvent_SubProcess';

    const startEvent = subProcessModelFacade.getSingleStartEvent();

    should(startEvent).be.instanceOf(Model.Events.StartEvent);
    should(startEvent.id).be.equal(expectedStartEventId);
  });
});
