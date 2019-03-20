import * as should from 'should';

import {Model} from '@process-engine/process_model.contracts';

import {ProcessModelFacade} from '../../src/runtime/facades/process_model_facade';
import {TestFixtureProvider} from '../test_fixture_provider';

describe('ProcessModelFacade.getFlowNodeById', () => {

  let fixtureProvider: TestFixtureProvider;

  before(async() => {
    fixtureProvider = new TestFixtureProvider();
    await fixtureProvider.initialize();
  });

  it('should be able to return each FlowNode of the given ProcessModel.', async() => {

    const processModelFilePath: string = './test/bpmns/process_engine_io_release.bpmn';
    const parsedProcessModel: Model.Process = await fixtureProvider.parseProcessModelFromFile(processModelFilePath);
    const processModelFacade: ProcessModelFacade = fixtureProvider.createProcessModelFacade(parsedProcessModel);

    const expectedFlowNodeIds: Array<string> = [
      'ausserordentlicher_start',
      'ExclusiveSplitGateway_1',
      'ExclusiveJoinGateway_1',
      'ParallelSplitGateway_1',
      'Task_1tfjjzx',
      'Task_0a4b1bm',
      'Task_0bbikg1',
      'ParallelJoinGateway_1',
      'EndEvent_0eie6q6',
    ];

    for (const expectedId of expectedFlowNodeIds) {
      const flowNode: Model.Base.FlowNode = processModelFacade.getFlowNodeById(expectedId);
      assertFlowNode(flowNode, expectedId);
    }
  });

  it('should be able to return each FlowNode of the given ProcessModel, even it has no lanes.', async() => {

    const processModelFilePath: string = './test/bpmns/generic_sample.bpmn';
    const parsedProcessModel: Model.Process = await fixtureProvider.parseProcessModelFromFile(processModelFilePath);
    const processModelFacade: ProcessModelFacade = fixtureProvider.createProcessModelFacade(parsedProcessModel);

    const expectedFlowNodeId: Array<string> = [
      'ProcessInputEvent',
      'ShouldEncryptGateway',
      'ShouldEncryptJoin',
      'ProcessResultEvent',
      'HandleErrorStoreActivityJoinGateway',
      'TransformActivity',
      'TokenizeActivity',
      'EncryptActivity',
      'StoreActivity',
    ];

    for (const expectedId of expectedFlowNodeId) {
      const flowNode: Model.Base.FlowNode = processModelFacade.getFlowNodeById(expectedId);
      assertFlowNode(flowNode, expectedId);
    }
  });

  it('should be able to return each FlowNode of the given ProcessModel, if they are spread across multiple lanes.', async() => {

    const processModelFilePath: string = './test/bpmns/sublane_test.bpmn';
    const parsedProcessModel: Model.Process = await fixtureProvider.parseProcessModelFromFile(processModelFilePath);
    const processModelFacade: ProcessModelFacade = fixtureProvider.createProcessModelFacade(parsedProcessModel);

    const expectedEndEventIds: Array<string> = [
      'StartEvent_1',
      'ExclusiveGateway_1ax0imj',
      'Task_0ukwbko',
      'Task_0e8cbxl',
      'EndEvent_1',
      'EndEvent_2',
    ];

    for (const expectedId of expectedEndEventIds) {
      const flowNode: Model.Base.FlowNode = processModelFacade.getFlowNodeById(expectedId);
      assertFlowNode(flowNode, expectedId);
    }
  });

  function assertFlowNode(flowNode: Model.Base.FlowNode, expectedId: string): void {
    should.exist(flowNode, `The Facade was unable to find the FlowNode '${expectedId}'!`);
    should(flowNode.id).be.equal(expectedId, `The Facade returned an incorrect FlowNode! Expected ${expectedId}, but got ${flowNode.id}!`);
  }
});
