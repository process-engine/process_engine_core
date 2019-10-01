import * as should from 'should';

import {Model} from '@process-engine/persistence_api.contracts';

import {ProcessModelFacade} from '../../../src/runtime/facades/process_model_facade';
import {TestFixtureProvider} from '../../test_fixture_provider';

describe('ProcessModelFacade.getStartEventById', (): void => {

  let fixtureProvider: TestFixtureProvider;

  let processModelFacade: ProcessModelFacade;

  before(async (): Promise<void> => {
    fixtureProvider = new TestFixtureProvider();
    await fixtureProvider.initialize();

    const processModelFilePath = 'generic_sample.bpmn';
    const parsedProcessModel = await fixtureProvider.parseProcessModelFromFile(processModelFilePath);
    processModelFacade = fixtureProvider.createProcessModelFacade(parsedProcessModel);
  });

  it('Should return one StartEvent for a ProcessModel that only has one.', async (): Promise<void> => {

    const startEventId = 'ProcessInputEvent';

    const startEvent = processModelFacade.getStartEventById(startEventId);

    should(startEvent).be.instanceOf(Model.Events.StartEvent);
    should(startEvent.id).be.equal(startEventId);
  });

  it('Should throw an error when attempting to retrieve a non-existing StartEvent.', async (): Promise<void> => {

    const startEventId = 'SomeNonExistingStartEvent';

    try {
      const startEvent = processModelFacade.getStartEventById(startEventId);
      should.fail(startEvent, undefined, 'This should have caused an error, because the StartEvent does not exist!');
    } catch (error) {
      const expectedErrorMessage = /not found/i;
      const expectedErrorCode = 404;
      should(error.message).be.match(expectedErrorMessage);
      should(error.code).be.equal(expectedErrorCode);
    }
  });
});
