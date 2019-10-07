import * as should from 'should';

import {ProcessToken} from '@process-engine/persistence_api.contracts';

import {TestFixtureProvider} from '../../test_fixture_provider';
import {ProcessTokenFacade} from '../../../src/runtime/facades';

describe('ProcessTokenFacade.createProcessToken', (): void => {

  let fixtureProvider: TestFixtureProvider;
  let processTokenFacade: ProcessTokenFacade;

  before(async (): Promise<void> => {
    fixtureProvider = new TestFixtureProvider();
    await fixtureProvider.initialize();
  });

  it('Should return a new ProcessToken that has all the correct values assigned to it.', async (): Promise<void> => {

    const sampleProcessInstanceId = '12346845641452343245254234';
    const sampleProcessModelId = 'IamAProcess';
    const sampleCorrelationId = 'randomcorrelation';
    const samplePayload = '132112341233124';

    processTokenFacade = fixtureProvider.createProcessTokenFacade(sampleProcessInstanceId, sampleProcessModelId, sampleCorrelationId);

    const result = processTokenFacade.createProcessToken(samplePayload);

    should(result).be.instanceOf(ProcessToken);
    should(result.processInstanceId).be.equal(sampleProcessInstanceId);
    should(result.processModelId).be.equal(sampleProcessModelId);
    should(result.correlationId).be.equal(sampleCorrelationId);
    should(result.identity).be.equal(fixtureProvider.sampleIdentity);
    should(result.payload).be.equal(samplePayload);
  });
});
