import * as should from 'should';

import {TestFixtureProvider} from '../../test_fixture_provider';
import {ProcessTokenFacade} from '../../../src/runtime/facades';

describe('ProcessTokenFacade.importResults', (): void => {

  let fixtureProvider: TestFixtureProvider;
  let processTokenFacade: ProcessTokenFacade;

  before(async (): Promise<void> => {
    fixtureProvider = new TestFixtureProvider();
    await fixtureProvider.initialize();

    processTokenFacade = fixtureProvider.createProcessTokenFacade();
    fixtureProvider.addSampleResultsToProcessTokenFacade(processTokenFacade);
  });

  it('Should successfully add a number of results to the existing result set.', async (): Promise<void> => {

    const firstResultSet = processTokenFacade.getAllResults();

    should(firstResultSet).be.length(3);

    const resultsToImport = [{
      flowNodeId: 'hello',
      flowNodeInstanceId: '12345',
      result: {},
    }, {
      flowNodeId: 'HelloAgain',
      flowNodeInstanceId: '67890',
      result: 'asdf',
    }];

    processTokenFacade.importResults(resultsToImport);

    const updatedResultSet = processTokenFacade.getAllResults();

    should(updatedResultSet).be.length(5);
  });
});
