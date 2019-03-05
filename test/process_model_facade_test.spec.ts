import {before, describe, it} from 'mocha';
import * as should from 'should';

import {Model} from '@process-engine/process_model.contracts';

import {ProcessModelFacade} from '../src/runtime/process_model_facade';
import {TestFixtureProvider} from './fixture_providers/test_fixture_provider';

describe('ProcessModelFacade.getLaneForFlowNode', () => {

  let fixtureProvider: TestFixtureProvider;

  before(async() => {
    fixtureProvider = new TestFixtureProvider();
    await fixtureProvider.initialize();
  });

  it('should successfully get the lane for each FlowNode of the process_engine_io_release.bpmn Diagram', async() => {

    const processModelFilePath: string = './test/bpmns/process_engine_io_release.bpmn';
    const parsedProcessModel: Model.Process = await fixtureProvider.parseProcessModelFromFile(processModelFilePath);

    const processModelFacade: ProcessModelFacade = fixtureProvider.createProcessModelFacade(parsedProcessModel);

    // TODO
    should.exist(processModelFacade);
  });
});
