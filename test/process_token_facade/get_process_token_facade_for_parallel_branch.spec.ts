/* eslint-disable dot-notation */
import * as should from 'should';

import {TestFixtureProvider} from '../test_fixture_provider';
import {ProcessTokenFacade} from '../../src/runtime/facades';

describe('ProcessTokenFacade.getProcessTokenFacadeForParallelBranch', (): void => {

  let fixtureProvider: TestFixtureProvider;
  let processTokenFacade: ProcessTokenFacade;

  before(async (): Promise<void> => {
    fixtureProvider = new TestFixtureProvider();
    await fixtureProvider.initialize();

    processTokenFacade = fixtureProvider.createProcessTokenFacade();
    fixtureProvider.addSampleResultsToProcessTokenFacade(processTokenFacade);
  });

  it('should return an exact copy of the ProcessTokenFacade.', async (): Promise<void> => {

    const firstResultSet = processTokenFacade.getAllResults();

    should(firstResultSet).be.an.Array();
    should(firstResultSet).be.length(3, 'Something went wrong while cloning the stored results of the facade!');

    const clonedFacade = processTokenFacade.getProcessTokenFacadeForParallelBranch();

    const clonedResultSet = clonedFacade.getAllResults();

    should(clonedResultSet).be.an.Array();
    should(clonedResultSet).be.length(3, 'Something went wrong while cloning the stored results of the facade!');

    // Since we are accessing private fields here, we need to get around the compiler errors that would occur.
    // See here https://stackoverflow.com/questions/35987055/how-to-write-unit-testing-for-angular-2-typescript-for-private-methods-with-ja
    should(clonedFacade['correlationId']).be.equal(processTokenFacade['correlationId']);
    should(clonedFacade['identity']).be.equal(processTokenFacade['identity']);
    should(clonedFacade['processInstanceId']).be.equal(processTokenFacade['processInstanceId']);
    should(clonedFacade['processModelId']).be.equal(processTokenFacade['processModelId']);
  });

  it('should not affect the original facade, when values on the cloned facade are changed.', async (): Promise<void> => {

    const clonedFacade = processTokenFacade.getProcessTokenFacadeForParallelBranch();
    clonedFacade.addResultForFlowNode('sampleFlowNodeId', 'flowNodeInstanceId', 'sampleResult');

    const clonedResultSet = clonedFacade.getAllResults();

    should(clonedResultSet).be.an.Array();
    should(clonedResultSet).be.length(4, 'Something went wrong while cloning the stored results of the facade!');

    const firstResultSet = processTokenFacade.getAllResults();

    should(firstResultSet).be.an.Array();
    should(firstResultSet).be.length(3, 'Something went wrong while cloning the stored results of the facade!');
  });

  it('should not affect the cloned facade, when values on the original facade are changed.', async (): Promise<void> => {

    const clonedFacade = processTokenFacade.getProcessTokenFacadeForParallelBranch();

    processTokenFacade.addResultForFlowNode('sampleFlowNodeId', 'flowNodeInstanceId', 'sampleResult');

    const firstResultSet = processTokenFacade.getAllResults();

    should(firstResultSet).be.an.Array();
    should(firstResultSet).be.length(4, 'Something went wrong while cloning the stored results of the facade!');

    const clonedResultSet = clonedFacade.getAllResults();

    should(clonedResultSet).be.an.Array();
    should(clonedResultSet).be.length(3, 'Something went wrong while cloning the stored results of the facade!');
  });
});
