/* eslint-disable dot-notation */
import * as should from 'should';

import {IFlowNodeInstanceResult} from '@process-engine/process_engine_contracts';

import {TestFixtureProvider} from '../../test_fixture_provider';

describe('ProcessTokenFacade.addResultForFlowNode', (): void => {

  let fixtureProvider: TestFixtureProvider;

  before(async (): Promise<void> => {
    fixtureProvider = new TestFixtureProvider();
    await fixtureProvider.initialize();
  });

  it('Should successfully add a new result to the facade.', async (): Promise<void> => {

    const processTokenFacade = fixtureProvider.createProcessTokenFacade();

    const sampleFlowNodeId = 'FancyFlowNodeId';
    const sampleFlowNodeInstanceId = 'abcdefghijklmnopqrstuvwxyz';
    const samplePayload = {hello: 'world'};

    processTokenFacade.addResultForFlowNode(sampleFlowNodeId, sampleFlowNodeInstanceId, samplePayload);

    // As using getAllResults would make this test cover more than it should, the results are retrieved from the private field itself.
    // Taken from https://stackoverflow.com/questions/35987055/how-to-write-unit-testing-for-angular-2-typescript-for-private-methods-with-ja
    const resultsStoredInFacade = processTokenFacade['processTokenResults'] as Array<IFlowNodeInstanceResult>;

    should(resultsStoredInFacade).be.an.Array();
    should(resultsStoredInFacade).be.length(1, 'The result set was not stored correctly!');

    const storedresult = resultsStoredInFacade[0];

    should(storedresult.flowNodeId).be.equal(sampleFlowNodeId);
    should(storedresult.flowNodeInstanceId).be.equal(sampleFlowNodeInstanceId);
    should(storedresult.result).be.eql(samplePayload);
  });

  it('Should not overwrite any existing results, when adding new results.', async (): Promise<void> => {

    const processTokenFacade = fixtureProvider.createProcessTokenFacade();

    fixtureProvider.addSampleResultsToProcessTokenFacade(processTokenFacade);

    const sampleResults = processTokenFacade['processTokenResults'] as Array<IFlowNodeInstanceResult>;

    should(sampleResults).be.an.Array();
    should(sampleResults).be.length(3, 'Adding the sample results to the ProcessTokenFacade failed!');

    const sampleFlowNodeId = 'FancyFlowNodeId';
    const sampleFlowNodeInstanceId = 'abcdefghijklmnopqrstuvwxyz';
    const samplePayload = {hello: 'world'};

    processTokenFacade.addResultForFlowNode(sampleFlowNodeId, sampleFlowNodeInstanceId, samplePayload);

    const resultsStoredInFacade = processTokenFacade['processTokenResults'] as Array<IFlowNodeInstanceResult>;

    should(resultsStoredInFacade).be.an.Array();
    should(resultsStoredInFacade).be.length(4, 'The result set was not stored correctly!');
  });
});
