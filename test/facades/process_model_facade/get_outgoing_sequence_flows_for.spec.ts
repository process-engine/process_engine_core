import * as should from 'should';

import {ProcessModelFacade} from '../../../src/runtime/facades/process_model_facade';
import {TestFixtureProvider} from '../../test_fixture_provider';

describe('ProcessModelFacade.getOutgoingSequenceFlowsFor', (): void => {

  let fixtureProvider: TestFixtureProvider;

  let processModelFacade: ProcessModelFacade;

  before(async (): Promise<void> => {
    fixtureProvider = new TestFixtureProvider();
    await fixtureProvider.initialize();

    const processModelFilePath = 'process_engine_io_release.bpmn';
    const parsedProcessModel = await fixtureProvider.parseProcessModelFromFile(processModelFilePath);
    processModelFacade = fixtureProvider.createProcessModelFacade(parsedProcessModel);
  });

  it('Should correctly return the outgoing SequenceFlows for a FlowNode with a single outgoing SequenceFlow.', async (): Promise<void> => {

    const flowNodeId = 'Task_1tfjjzx';
    const expectedSequenceFlowId = 'SequenceFlow_0uaexrv';

    const sequenceFlows = processModelFacade.getOutgoingSequenceFlowsFor(flowNodeId);

    should(sequenceFlows).be.instanceOf(Array);
    should(sequenceFlows.length).be.equal(1);
    should(sequenceFlows[0].id).be.equal(expectedSequenceFlowId);
  });

  it('Should correctly return the outgoing SequenceFlows for a FlowNode with multiple outgoing SequenceFlows.', async (): Promise<void> => {

    const flowNodeId = 'ParallelSplitGateway_1';

    const expectedSequenceFlowIds = [
      'SequenceFlow_1nt9fw9',
      'SequenceFlow_1vprubq',
      'SequenceFlow_17awqho',
    ];

    const sequenceFlows = processModelFacade.getOutgoingSequenceFlowsFor(flowNodeId);

    should(sequenceFlows).be.instanceOf(Array);
    should(sequenceFlows.length).be.equal(3);

    for (const sequenceFlow of sequenceFlows) {
      should(expectedSequenceFlowIds).containEql(sequenceFlow.id);
    }
  });

  it('Should return an empty Array for a FlowNode that doesn\'t have any outgoing SequenceFlows.', async (): Promise<void> => {

    const flowNodeId = 'EndEvent_0y6uwzm';

    const sequenceFlows = processModelFacade.getOutgoingSequenceFlowsFor(flowNodeId);

    should(sequenceFlows).be.instanceOf(Array);
    should(sequenceFlows.length).be.equal(0);
  });
});
