import * as should from 'should';

import {Model} from '@process-engine/process_model.contracts';

import {ProcessModelFacade} from '../../src/runtime/facades/process_model_facade';
import {TestFixtureProvider} from '../test_fixture_provider';

// tslint:disable:no-magic-numbers
describe('ProcessModelFacade.getOutgoingSequenceFlowsFor', () => {

  let fixtureProvider: TestFixtureProvider;

  let processModelFacade: ProcessModelFacade;

  before(async() => {
    fixtureProvider = new TestFixtureProvider();
    await fixtureProvider.initialize();

    const processModelFilePath: string = './test/bpmns/process_engine_io_release.bpmn';
    const parsedProcessModel: Model.Process = await fixtureProvider.parseProcessModelFromFile(processModelFilePath);
    processModelFacade = fixtureProvider.createProcessModelFacade(parsedProcessModel);
  });

  it('should correctly return the outgoing SequenceFlows for a FlowNode with a single outgoing SequenceFlow.', async() => {

    const flowNodeId: string = 'Task_1tfjjzx';
    const expectedSequenceFlowId: string = 'SequenceFlow_0uaexrv';

    const sequenceFlows: Array<Model.ProcessElements.SequenceFlow> = processModelFacade.getOutgoingSequenceFlowsFor(flowNodeId);

    should(sequenceFlows).be.instanceOf(Array);
    should(sequenceFlows.length).be.equal(1);
    should(sequenceFlows[0].id).be.equal(expectedSequenceFlowId);
  });

  it('should correctly return the outgoing SequenceFlows for a FlowNode with multiple outgoing SequenceFlows.', async() => {

    const flowNodeId: string = 'ParallelSplitGateway_1';

    const expectedSequenceFlowIds: Array<string> = [
      'SequenceFlow_1nt9fw9',
      'SequenceFlow_1vprubq',
      'SequenceFlow_17awqho',
    ];

    const sequenceFlows: Array<Model.ProcessElements.SequenceFlow> = processModelFacade.getOutgoingSequenceFlowsFor(flowNodeId);

    should(sequenceFlows).be.instanceOf(Array);
    should(sequenceFlows.length).be.equal(3);

    for (const sequenceFlow of sequenceFlows) {
      should(expectedSequenceFlowIds).containEql(sequenceFlow.id);
    }
  });

  it('should return an empty Array for a FlowNode that doesn\'t have any outgoing SequenceFlows.', async() => {

    const flowNodeId: string = 'EndEvent_0y6uwzm';

    const sequenceFlows: Array<Model.ProcessElements.SequenceFlow> = processModelFacade.getOutgoingSequenceFlowsFor(flowNodeId);

    should(sequenceFlows).be.instanceOf(Array);
    should(sequenceFlows.length).be.equal(0);
  });
});
