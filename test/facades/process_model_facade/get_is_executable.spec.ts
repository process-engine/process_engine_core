import * as should from 'should';

import {ProcessModelFacade} from '../../../src/runtime/facades/process_model_facade';
import {TestFixtureProvider} from '../../test_fixture_provider';

describe('ProcessModelFacade.getIsExecutable', (): void => {

  let fixtureProvider: TestFixtureProvider;

  let processModelFacade: ProcessModelFacade;

  before(async (): Promise<void> => {
    fixtureProvider = new TestFixtureProvider();
    await fixtureProvider.initialize();

    const processModelFilePath = 'process_engine_io_release.bpmn';
    const parsedProcessModel = await fixtureProvider.parseProcessModelFromFile(processModelFilePath);

    processModelFacade = fixtureProvider.createProcessModelFacade(parsedProcessModel);
  });

  it('Should correctly return the isExecutable flag of the ProcessModel.', async (): Promise<void> => {

    const isExecutable = processModelFacade.getIsExecutable();

    should(isExecutable).be.true();
  });
});
