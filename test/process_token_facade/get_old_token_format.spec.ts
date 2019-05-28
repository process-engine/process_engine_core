import * as should from 'should';

import {TestFixtureProvider} from '../test_fixture_provider';
import {ProcessTokenFacade} from '../../src/runtime/facades';

describe('ProcessTokenFacade.getOldTokenFormat', (): void => {

  let fixtureProvider: TestFixtureProvider;
  let processTokenFacade: ProcessTokenFacade;

  before(async (): Promise<void> => {
    fixtureProvider = new TestFixtureProvider();
    await fixtureProvider.initialize();

    processTokenFacade = fixtureProvider.createProcessTokenFacade();
    fixtureProvider.addSampleResultsToProcessTokenFacade(processTokenFacade);
  });

  // eslint-disable-next-line max-len
  it('should return all the stored results in a format the represents the old "token: {current: {}, history: {}}" format.', async (): Promise<void> => {

    const results = processTokenFacade.getOldTokenFormat();

    const expectedHistoryKeys = ['StartEvent_1', 'ServiceTask_1', 'EndEvent_1'];
    const expectedCurrentValue = {endResult: 'Dakka.'};

    should(results).be.an.Object();
    should(results).have.properties('current', 'history');
    should(results.history).have.properties(...expectedHistoryKeys);
    should(results.current).be.eql(expectedCurrentValue);
  });
});
