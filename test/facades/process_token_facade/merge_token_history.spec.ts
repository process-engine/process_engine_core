import * as should from 'should';

import {TestFixtureProvider} from '../../test_fixture_provider';
import {ProcessTokenFacade} from '../../../src/runtime/facades';

describe('ProcessTokenFacade.mergeTokenHistory', (): void => {

  let fixtureProvider: TestFixtureProvider;
  let processTokenFacade: ProcessTokenFacade;

  before(async (): Promise<void> => {
    fixtureProvider = new TestFixtureProvider();
    await fixtureProvider.initialize();

    processTokenFacade = fixtureProvider.createProcessTokenFacade();
    fixtureProvider.addSampleResultsToProcessTokenFacade(processTokenFacade);
  });

  it('Should successfully merge the token history of the first facade into the second.', async (): Promise<void> => {

    const resultsToImport = [{
      flowNodeId: 'hello',
      flowNodeInstanceId: '12345',
      result: {},
    }, {
      flowNodeId: 'HelloAgain',
      flowNodeInstanceId: '67890',
      result: 'asdf',
    }];

    const secondProcessTokenFacade = fixtureProvider.createProcessTokenFacade('someProcessInstanceId', 'randomProcessModel', 'randomcorrelation');
    secondProcessTokenFacade.importResults(resultsToImport);

    const resultsToMerge = processTokenFacade.getAllResults();

    secondProcessTokenFacade.importResults(resultsToMerge);

    const finalResultSet = secondProcessTokenFacade.getAllResults();

    should(finalResultSet).be.an.Array();
    should(finalResultSet).be.length(5);
  });
});
