import {before, describe, it} from 'mocha';
import * as should from 'should';

import {Model} from '@process-engine/process_model.contracts';

import {ProcessModelFacade} from '../../../src/runtime/process_model_facade';
import {TestFixtureProvider} from './test_fixture_provider';

describe('ProcessModelParser ', () => {

  let fixtureProvider: TestFixtureProvider;

  before(async() => {
    fixtureProvider = new TestFixtureProvider();
    await fixtureProvider.initialize();
  });

  it('should successfully parse the process_engine_io_release.bpmn Diagram, which contains one lane', async() => {

    const processModelFilePath: string = './test/bpmns/process_engine_io_release.bpmn';
    const parsedProcessModel: Model.Process = await fixtureProvider.parseProcessModelFromFile(processModelFilePath);

    const expectedFlowNodeIdList: Array<string> = [
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

    await fixtureProvider.assertThatProcessModelHasFlowNodes(parsedProcessModel, expectedFlowNodeIdList);
  });

  it('should successfully parse the DemoNutztierRiss.bpmn Diagram, which contains multiple parallel lanes', async() => {

    const processModelFilePath: string = './test/bpmns/DemoNutztierRiss.bpmn';
    const parsedProcessModel: Model.Process = await fixtureProvider.parseProcessModelFromFile(processModelFilePath);

    const expectedFlowNodeIdList: Array<string> = [
      'StartEvent_1',
      'VorgangErfassen',
      'Task_01xg9lr',
      'Task_00dom74',
      'notizSchreiben',
      'Task_1tk0lhq',
      'Task_1yzqmfq',
      'EndEvent_05uuvaq',
    ];

    await fixtureProvider.assertThatProcessModelHasFlowNodes(parsedProcessModel, expectedFlowNodeIdList);

    const processModelFacade: ProcessModelFacade = fixtureProvider.createProcessModelFacade(parsedProcessModel);

    const vorgangAnlegen: Model.Activities.ServiceTask = processModelFacade.getFlowNodeById('Task_01xg9lr') as Model.Activities.ServiceTask;
    const invocation: Model.Activities.Invocations.MethodInvocation = vorgangAnlegen.invocation as Model.Activities.Invocations.MethodInvocation;

    should(invocation.module).be.eql('HttpClient');
    should(invocation.method).be.eql('post');
    should(invocation.params).be.eql('[\'http://localhost:5000/api/vorgaenge/anlegen\', token.history.VorgangErfassen]');
  });

  it('should successfully parse the generic_sample.bpmn Diagram, which contains no lanes', async() => {

    const processModelFilePath: string = './test/bpmns/generic_sample.bpmn';
    const parsedProcessModel: Model.Process = await fixtureProvider.parseProcessModelFromFile(processModelFilePath);

    const expectedFlowNodeIdList: Array<string> = [
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

    await fixtureProvider.assertThatProcessModelHasFlowNodes(parsedProcessModel, expectedFlowNodeIdList);
  });

  it('should successfully parse the empty_lane_test.bpmn Diagram, which contains an empty lane', async() => {

    const processModelFilePath: string = './test/bpmns/empty_lane_test.bpmn';
    const parsedProcessModel: Model.Process = await fixtureProvider.parseProcessModelFromFile(processModelFilePath);

    const expectedFlowNodeIdList: Array<string> = [
      'StartEvent_1mox3jl',
      'EndEvent_0eie6q6',
    ];

    await fixtureProvider.assertThatProcessModelHasFlowNodes(parsedProcessModel, expectedFlowNodeIdList);
  });

  it('should successfully parse the sublane_test.bpmn Diagram, which contains several sublanes', async() => {

    const processModelFilePath: string = './test/bpmns/sublane_test.bpmn';
    const parsedProcessModel: Model.Process = await fixtureProvider.parseProcessModelFromFile(processModelFilePath);

    const expectedFlowNodeIdList: Array<string> = [
      'StartEvent_1',
      'ExclusiveGateway_1ax0imj',
      'Task_0ukwbko',
      'Task_0e8cbxl',
      'EndEvent_1',
      'EndEvent_2',
    ];

    await fixtureProvider.assertThatProcessModelHasFlowNodes(parsedProcessModel, expectedFlowNodeIdList);
  });
});
