import * as should from 'should';

import {ProcessModelFacadeFactory} from '../../../src/runtime/facades/process_model_facade_factory';
import {ProcessModelFacade} from '../../../src/runtime/facades/process_model_facade';
import {TestFixtureProvider} from '../../test_fixture_provider';

describe('ProcessModelFacadeFactory.create', (): void => {

  let fixtureProvider: TestFixtureProvider;
  let processModelFacadeFactory: ProcessModelFacadeFactory;

  before(async (): Promise<void> => {
    fixtureProvider = new TestFixtureProvider();
    await fixtureProvider.initialize();

    processModelFacadeFactory = new ProcessModelFacadeFactory();
  });

  it('Should create a new instance of a ProcessModelFacade, using the provided ProcessModel as a baseline', async (): Promise<void> => {

    const sampleProcessModel = await fixtureProvider.parseProcessModelFromFile('user_task_test.bpmn');

    const processModelFacade = processModelFacadeFactory.create(sampleProcessModel);

    should(processModelFacade).be.instanceOf(ProcessModelFacade);

    // Make some queries against the created facade, to check if it behaves as expected.
    const startEvents = processModelFacade.getStartEvents();
    const processModelHasLanes = processModelFacade.getProcessModelHasLanes();
    const processModelIsExecutable = processModelFacade.getIsExecutable();

    should(processModelHasLanes).be.true();
    should(processModelIsExecutable).be.true();
    should(startEvents).be.an.Array();
    should(startEvents.length).be.equal(1);
    should(startEvents[0].id).be.equal('StartEvent_1');
  });

  it('Should throw an error, if no ProcessModel is provided', (): void => {
    try {
      const processModelFacade = processModelFacadeFactory.create(undefined);
      should.fail(processModelFacade, undefined, 'This should not have succeeded, because no ProcessModel was provided!');
    } catch (error) {
      should(error.message).be.match(/must provide a processmodel/i);
    }
  });
});
