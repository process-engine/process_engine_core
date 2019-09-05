import * as should from 'should';

import {TestFixtureProvider} from '../../test_fixture_provider';

describe('ProcessModelFacade.getStartEvents', (): void => {

  let fixtureProvider: TestFixtureProvider;

  before(async (): Promise<void> => {
    fixtureProvider = new TestFixtureProvider();
    await fixtureProvider.initialize();
  });

  it('Should return one StartEvent for a ProcessModel that only has one.', async (): Promise<void> => {

    const processModelFilePath = 'generic_sample.bpmn';
    const parsedProcessModel = await fixtureProvider.parseProcessModelFromFile(processModelFilePath);
    const processModelFacade = fixtureProvider.createProcessModelFacade(parsedProcessModel);

    const expectedStartEventId = 'ProcessInputEvent';

    const startEvents = processModelFacade.getStartEvents();

    should(startEvents).be.instanceOf(Array);
    should(startEvents.length).be.equal(1);
    should(startEvents[0].id).be.equal(expectedStartEventId);
  });

  it('Should return all StartEvents from a ProcessModel with multiple StartEvents.', async (): Promise<void> => {

    const processModelFilePath = 'intermediate_event_link_test.bpmn';
    const parsedProcessModel = await fixtureProvider.parseProcessModelFromFile(processModelFilePath);
    const processModelFacade = fixtureProvider.createProcessModelFacade(parsedProcessModel);

    const expectedStartEventIds = [
      'StartEvent_1',
      'StartEvent_2',
      'StartEvent_666',
    ];

    const startEvents = processModelFacade.getStartEvents();

    should(startEvents).be.instanceOf(Array);
    should(startEvents.length).be.equal(3);

    for (const startEvent of startEvents) {
      should(expectedStartEventIds).containEql(startEvent.id);
    }
  });
});
