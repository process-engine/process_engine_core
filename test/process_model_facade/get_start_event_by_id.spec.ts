import * as should from 'should';

import {Model} from '@process-engine/process_model.contracts';

import {ProcessModelFacade} from '../../src/runtime/facades/process_model_facade';
import {TestFixtureProvider} from '../test_fixture_provider';

describe('ProcessModelFacade.getStartEventById', () => {

  let fixtureProvider: TestFixtureProvider;

  let processModelFacade: ProcessModelFacade;

  before(async() => {
    fixtureProvider = new TestFixtureProvider();
    await fixtureProvider.initialize();

    const processModelFilePath: string = './test/bpmns/generic_sample.bpmn';
    const parsedProcessModel: Model.Process = await fixtureProvider.parseProcessModelFromFile(processModelFilePath);
    processModelFacade = fixtureProvider.createProcessModelFacade(parsedProcessModel);
  });

  it('should return one StartEvent for a ProcessModel that only has one.', async() => {

    const startEventId: string = 'ProcessInputEvent';

    const startEvent: Model.Events.StartEvent = processModelFacade.getStartEventById(startEventId);

    should(startEvent).be.instanceOf(Model.Events.StartEvent);
    should(startEvent.id).be.equal(startEventId);
  });

  it('should throw an error when attempting to retrieve a non-existing StartEvent.', async() => {

    const startEventId: string = 'SomeNonExistingStartEvent';

    try {
      const startEvent: Model.Events.StartEvent = processModelFacade.getStartEventById(startEventId);
      should.fail(startEvent, undefined, 'This should have caused an error, because the StartEvent does not exist!');
    } catch (error) {
      const expectedErrorMessage: RegExp = /not found/i;
      const expectedErrorCode: number = 404;
      should(error.message).be.match(expectedErrorMessage);
      should(error.code).be.equal(expectedErrorCode);
    }
  });
});
