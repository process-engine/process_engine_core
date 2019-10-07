import * as should from 'should';

import {Model} from '@process-engine/persistence_api.contracts';

import {TestFixtureProvider} from '../../test_fixture_provider';

describe('ProcessModelFacade.getSingleStartEvent', (): void => {

  let fixtureProvider: TestFixtureProvider;

  before(async (): Promise<void> => {
    fixtureProvider = new TestFixtureProvider();
    await fixtureProvider.initialize();
  });

  it('Should return the single StartEvent for a ProcessModel that only has one.', async (): Promise<void> => {

    const processModelFilePath = 'generic_sample.bpmn';
    const parsedProcessModel = await fixtureProvider.parseProcessModelFromFile(processModelFilePath);
    const processModelFacade = fixtureProvider.createProcessModelFacade(parsedProcessModel);

    const expectedStartEventId = 'ProcessInputEvent';

    const startEvent = processModelFacade.getSingleStartEvent();

    should(startEvent).be.instanceOf(Model.Events.StartEvent);
    should(startEvent.id).be.equal(expectedStartEventId);
  });

  it('Should pick the first StartEvent from a ProcessModel with multiple StartEvents.', async (): Promise<void> => {

    const processModelFilePath = 'intermediate_event_link_test.bpmn';
    const parsedProcessModel = await fixtureProvider.parseProcessModelFromFile(processModelFilePath);
    const processModelFacade = fixtureProvider.createProcessModelFacade(parsedProcessModel);

    const expectedStartEventId = 'StartEvent_1';

    const startEvent = processModelFacade.getSingleStartEvent();

    should(startEvent).be.instanceOf(Model.Events.StartEvent);
    should(startEvent.id).be.equal(expectedStartEventId);
  });
});
