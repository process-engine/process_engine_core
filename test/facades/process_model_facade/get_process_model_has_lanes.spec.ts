import * as should from 'should';

import {TestFixtureProvider} from '../../test_fixture_provider';

describe('ProcessModelFacade.getProcessModelHasLanes', (): void => {

  let fixtureProvider: TestFixtureProvider;

  before(async (): Promise<void> => {
    fixtureProvider = new TestFixtureProvider();
    await fixtureProvider.initialize();
  });

  it('Should return true for a ProcessModel with at least one lane.', async (): Promise<void> => {

    const processModelFilePath = 'DemoNutztierRiss.bpmn';
    const parsedProcessModel = await fixtureProvider.parseProcessModelFromFile(processModelFilePath);

    const processModelFacade = fixtureProvider.createProcessModelFacade(parsedProcessModel);

    const processModelHasLanes = processModelFacade.getProcessModelHasLanes();
    should(processModelHasLanes).be.true();
  });

  it('Should return true for a ProcessModel whose FlowNodes are all located in sublanes.', async (): Promise<void> => {

    const processModelFilePath = 'sublane_test.bpmn';
    const parsedProcessModel = await fixtureProvider.parseProcessModelFromFile(processModelFilePath);

    const processModelFacade = fixtureProvider.createProcessModelFacade(parsedProcessModel);

    const processModelHasLanes = processModelFacade.getProcessModelHasLanes();
    should(processModelHasLanes).be.true();
  });

  it('Should return false for a ProcessModel with no lanes.', async (): Promise<void> => {

    const processModelFilePath = 'generic_sample.bpmn';
    const parsedProcessModel = await fixtureProvider.parseProcessModelFromFile(processModelFilePath);

    const processModelFacade = fixtureProvider.createProcessModelFacade(parsedProcessModel);

    const processModelHasLanes = processModelFacade.getProcessModelHasLanes();
    should(processModelHasLanes).be.false();
  });
});
