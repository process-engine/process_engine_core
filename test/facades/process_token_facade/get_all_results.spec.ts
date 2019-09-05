import * as should from 'should';

import {TestFixtureProvider} from '../../test_fixture_provider';
import {ProcessTokenFacade} from '../../../src/runtime/facades';

describe('ProcessTokenFacade.containsResultForFlowNodeInstance', (): void => {

  let fixtureProvider: TestFixtureProvider;
  let processTokenFacade: ProcessTokenFacade;

  before(async (): Promise<void> => {
    fixtureProvider = new TestFixtureProvider();
    await fixtureProvider.initialize();

    processTokenFacade = fixtureProvider.createProcessTokenFacade();
    fixtureProvider.addSampleResultsToProcessTokenFacade(processTokenFacade);
  });

  it('Should return all results that are currently stored in the facade.', async (): Promise<void> => {

    const results = processTokenFacade.getAllResults();

    should(results).be.an.Array();
    should(results).be.length(3, 'Something went wrong while adding the sample results to the ProcessTokenFacade!');
  });

  it('Should return a copy of the results to prevent manipulation of the internal result storage.', async (): Promise<void> => {

    const firstResultSet = processTokenFacade.getAllResults();

    should(firstResultSet).be.an.Array();
    should(firstResultSet).be.length(3, 'Something went wrong while adding the sample results to the ProcessTokenFacade!');

    // Now delete something from the returned result set.
    firstResultSet.pop();

    should(firstResultSet).be.length(2, 'Failed to remove the last entry from the first result set!');

    // Request the results again to make sure they remain unaffected.
    const secondResultSet = processTokenFacade.getAllResults();

    should(secondResultSet).be.length(3, 'The internal storage was changed, after the user removed an entry from the first collection!');
  });
});
