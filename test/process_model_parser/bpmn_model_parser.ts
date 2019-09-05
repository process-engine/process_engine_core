import * as should from 'should';

import {Model} from '@process-engine/process_model.contracts';

import {TestFixtureProvider} from '../test_fixture_provider';

describe('BpmnModelParser.parseXmlToObjectModel ', (): void => {

  let fixtureProvider: TestFixtureProvider;

  before(async (): Promise<void> => {
    fixtureProvider = new TestFixtureProvider();
    await fixtureProvider.initialize();
  });

  it('Should successfully parse a diagram that contains one lane.', async (): Promise<void> => {

    const processModelFilePath = 'process_engine_io_release.bpmn';
    const parsedProcessModel = await fixtureProvider.parseProcessModelFromFile(processModelFilePath);

    const expectedFlowNodeIdList = [
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

  it('Should successfully parse a diagram that contains multiple parallel lanes.', async (): Promise<void> => {

    const processModelFilePath = 'DemoNutztierRiss.bpmn';
    const parsedProcessModel = await fixtureProvider.parseProcessModelFromFile(processModelFilePath);

    const expectedFlowNodeIdList = [
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

    const processModelFacade = fixtureProvider.createProcessModelFacade(parsedProcessModel);

    const vorgangAnlegen = processModelFacade.getFlowNodeById('Task_01xg9lr') as Model.Activities.ServiceTask;
    const invocation = vorgangAnlegen.invocation as Model.Activities.Invocations.MethodInvocation;

    should(invocation.module).be.eql('HttpClient');
    should(invocation.method).be.eql('post');
    should(invocation.params).be.eql('[\'http://localhost:5000/api/vorgaenge/anlegen\', token.history.VorgangErfassen]');
  });

  it('Should successfully parse a diagram that contains no lanes.', async (): Promise<void> => {

    const processModelFilePath = 'generic_sample.bpmn';
    const parsedProcessModel = await fixtureProvider.parseProcessModelFromFile(processModelFilePath);

    const expectedFlowNodeIdList = [
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

  it('Should successfully parse a diagram that contains an empty lane.', async (): Promise<void> => {

    const processModelFilePath = 'empty_lane_test.bpmn';
    const parsedProcessModel = await fixtureProvider.parseProcessModelFromFile(processModelFilePath);

    const expectedFlowNodeIdList = [
      'StartEvent_1mox3jl',
      'EndEvent_0eie6q6',
    ];

    await fixtureProvider.assertThatProcessModelHasFlowNodes(parsedProcessModel, expectedFlowNodeIdList);
  });

  it('Should successfully parse a diagram that contains several sublanes.', async (): Promise<void> => {

    const processModelFilePath = 'sublane_test.bpmn';
    const parsedProcessModel = await fixtureProvider.parseProcessModelFromFile(processModelFilePath);

    const expectedFlowNodeIdList = [
      'StartEvent_1',
      'ExclusiveGateway_1ax0imj',
      'Task_0ukwbko',
      'Task_0e8cbxl',
      'EndEvent_1',
      'EndEvent_2',
    ];

    await fixtureProvider.assertThatProcessModelHasFlowNodes(parsedProcessModel, expectedFlowNodeIdList);
  });

  it('Should successfully parse SignalEndEvents with customized inputValues.', async (): Promise<void> => {

    const processModelFilePath = 'customized_signal_end_event_payload.bpmn';
    const parsedProcessModel = await fixtureProvider.parseProcessModelFromFile(processModelFilePath);

    const expectedFlowNodeIdList = [
      'startEvent',
      'ExclusiveGateway_0wu23g7',
      'Task_1',
      'Task_2',
      'Task_4',
      'Task_3',
      'ExclusiveGateway_1up33ka',
      'EndEvent_1',
    ];

    await fixtureProvider.assertThatProcessModelHasFlowNodes(parsedProcessModel, expectedFlowNodeIdList);

    const processModelFacade = fixtureProvider.createProcessModelFacade(parsedProcessModel);

    const endEvent = processModelFacade.getFlowNodeById('EndEvent_1') as Model.Events.EndEvent;

    const expectedInputValuesExpression = '{tradeId: token.history.startEvent.tradeId}';

    should(endEvent).have.property('inputValues');
    should(endEvent.inputValues).be.equal(expectedInputValuesExpression);
  });

  it('Should correctly interpret a default SequenceFlow for an ExclusiveSplitGateway.', async (): Promise<void> => {

    const processModelFilePath = 'default_sequence_flow_test.bpmn';
    const parsedProcessModel = await fixtureProvider.parseProcessModelFromFile(processModelFilePath);

    const expectedFlowNodeIdList = [
      'StartEvent_1',
      'EndEvent_1',
      'ExclusiveGateway_1',
      'EndEvent_2',
    ];

    await fixtureProvider.assertThatProcessModelHasFlowNodes(parsedProcessModel, expectedFlowNodeIdList);

    const processModelFacade = fixtureProvider.createProcessModelFacade(parsedProcessModel);

    const exclusiveGateway = processModelFacade.getFlowNodeById('ExclusiveGateway_1') as Model.Gateways.ExclusiveGateway;

    const expectedDefaultSequenceFlowId = 'DefaultSequenceFlowAfterGateway';

    should(exclusiveGateway).have.property('defaultOutgoingSequenceFlowId');
    should(exclusiveGateway.defaultOutgoingSequenceFlowId).be.equal(expectedDefaultSequenceFlowId);
  });
});
