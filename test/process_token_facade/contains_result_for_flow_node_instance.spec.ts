import * as should from 'should';

import {TestFixtureProvider} from '../test_fixture_provider';
import {ProcessTokenFacade} from '../../src/runtime/facades';

describe('ProcessTokenFacade.containsResultForFlowNodeInstance', (): void => {

  let fixtureProvider: TestFixtureProvider;
  let processTokenFacade: ProcessTokenFacade;

  before(async (): Promise<void> => {
    fixtureProvider = new TestFixtureProvider();
    await fixtureProvider.initialize();

    processTokenFacade = fixtureProvider.createProcessTokenFacade();
    fixtureProvider.addSampleResultsToProcessTokenFacade(processTokenFacade);
  });

  it('should return true, when the facade has currently stored a matching result.', async (): Promise<void> => {

    const sampleFlowNodeInstanceId = '132112341233124';
    const result = processTokenFacade.containsResultForFlowNodeInstance(sampleFlowNodeInstanceId);

    should(result).be.true();
  });

  it('should return false, when the facade does not contain a matching result.', async (): Promise<void> => {

    const sampleFlowNodeInstanceId = 'idonotexist';
    const result = processTokenFacade.containsResultForFlowNodeInstance(sampleFlowNodeInstanceId);

    should(result).be.false();
  });
});
