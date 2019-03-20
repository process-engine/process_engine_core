import * as should from 'should';

import {Model} from '@process-engine/process_model.contracts';

import {ProcessModelFacade} from '../../src/runtime/facades/process_model_facade';
import {TestFixtureProvider} from '../test_fixture_provider';

describe('ProcessModelFacade.getProcessModelHasLanes', () => {

  let fixtureProvider: TestFixtureProvider;

  before(async() => {
    fixtureProvider = new TestFixtureProvider();
    await fixtureProvider.initialize();
  });

  it('should return true for a ProcessModel with at least one lane.', async() => {

    const processModelFilePath: string = './test/bpmns/DemoNutztierRiss.bpmn';
    const parsedProcessModel: Model.Process = await fixtureProvider.parseProcessModelFromFile(processModelFilePath);

    const processModelFacade: ProcessModelFacade = fixtureProvider.createProcessModelFacade(parsedProcessModel);

    const processModelHasLanes: boolean = processModelFacade.getProcessModelHasLanes();
    should(processModelHasLanes).be.true();
  });

  it('should return true for a ProcessModel whose FlowNodes are all located in sublanes.', async() => {

    const processModelFilePath: string = './test/bpmns/sublane_test.bpmn';
    const parsedProcessModel: Model.Process = await fixtureProvider.parseProcessModelFromFile(processModelFilePath);

    const processModelFacade: ProcessModelFacade = fixtureProvider.createProcessModelFacade(parsedProcessModel);

    const processModelHasLanes: boolean = processModelFacade.getProcessModelHasLanes();
    should(processModelHasLanes).be.true();
  });

  it('should return false for a ProcessModel with no lanes.', async() => {

    const processModelFilePath: string = './test/bpmns/generic_sample.bpmn';
    const parsedProcessModel: Model.Process = await fixtureProvider.parseProcessModelFromFile(processModelFilePath);

    const processModelFacade: ProcessModelFacade = fixtureProvider.createProcessModelFacade(parsedProcessModel);

    const processModelHasLanes: boolean = processModelFacade.getProcessModelHasLanes();
    should(processModelHasLanes).be.false();
  });
});
