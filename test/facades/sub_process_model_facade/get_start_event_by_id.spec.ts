import * as should from 'should';

import {Model} from '@process-engine/persistence_api.contracts';

import {SubProcessModelFacade} from '../../../src/runtime/facades/sub_process_model_facade';
import {TestFixtureProvider} from '../../test_fixture_provider';

describe('SubProcessModelFacade.getStartEventById', (): void => {

  let fixtureProvider: TestFixtureProvider;

  let subProcessModelFacade: SubProcessModelFacade;

  before(async (): Promise<void> => {
    fixtureProvider = new TestFixtureProvider();
    await fixtureProvider.initialize();

    subProcessModelFacade = await fixtureProvider.createSubProcessModelFacade();
  });

  it('Should return the StartEvent that has the given ID.', async (): Promise<void> => {

    const startEventId = 'StartEvent_SubProcess';

    const startEvent = subProcessModelFacade.getStartEventById(startEventId);

    should(startEvent).be.instanceOf(Model.Events.StartEvent);
    should(startEvent.id).be.equal(startEventId);
  });

  it('Should throw an error when attempting to retrieve a non-existing StartEvent.', async (): Promise<void> => {

    const startEventId = 'SomeNonExistingStartEvent';

    try {
      const startEvent = subProcessModelFacade.getStartEventById(startEventId);
      should.fail(startEvent, undefined, 'This should have caused an error, because the StartEvent does not exist!');
    } catch (error) {
      const expectedErrorMessage = /not found/i;
      const expectedErrorCode = 404;
      should(error.message).be.match(expectedErrorMessage);
      should(error.code).be.equal(expectedErrorCode);
    }
  });

  it('Should throw an error when attempting to retrieve a StartEvent from outside the SubProcess.', async (): Promise<void> => {

    const startEventId = 'StartEvent_1';

    try {
      const startEvent = subProcessModelFacade.getStartEventById(startEventId);
      should.fail(startEvent, undefined, 'This should have caused an error, because the StartEvent is located outside the Subprocess!');
    } catch (error) {
      const expectedErrorMessage = /not found/i;
      const expectedErrorCode = 404;
      should(error.message).be.match(expectedErrorMessage);
      should(error.code).be.equal(expectedErrorCode);
    }
  });
});
