import * as should from 'should';

import {SubProcessModelFacade} from '../../../src/runtime/facades/sub_process_model_facade';
import {TestFixtureProvider} from '../../test_fixture_provider';

describe('SubProcessModelFacade.getOutgoingSequenceFlowsFor', (): void => {

  let fixtureProvider: TestFixtureProvider;

  let subProcessModelFacade: SubProcessModelFacade;

  before(async (): Promise<void> => {
    fixtureProvider = new TestFixtureProvider();
    await fixtureProvider.initialize();

    subProcessModelFacade = await fixtureProvider.createSubProcessModelFacade();
  });

  it('Should correctly return the outgoing SequenceFlows for a FlowNode with a single outgoing SequenceFlow.', async (): Promise<void> => {

    const flowNodeId = 'StartEvent_SubProcess';
    const expectedSequenceFlowId = 'SequenceFlow_0sa79yg';

    const sequenceFlows = subProcessModelFacade.getOutgoingSequenceFlowsFor(flowNodeId);

    should(sequenceFlows).be.instanceOf(Array);
    should(sequenceFlows.length).be.equal(1);
    should(sequenceFlows[0].id).be.equal(expectedSequenceFlowId);
  });

  it('Should correctly return the outgoing SequenceFlows for a FlowNode with multiple outgoing SequenceFlows.', async (): Promise<void> => {

    const flowNodeId = 'ExclusiveSplitGateway_SubProcess';

    const expectedSequenceFlowIds = [
      'SequenceFlow_125uwht',
      'SequenceFlow_1lyntlp',
      'SequenceFlow_1fr9bak',
    ];

    const sequenceFlows = subProcessModelFacade.getOutgoingSequenceFlowsFor(flowNodeId);

    should(sequenceFlows).be.instanceOf(Array);
    should(sequenceFlows.length).be.equal(3);

    for (const sequenceFlow of sequenceFlows) {
      should(expectedSequenceFlowIds).containEql(sequenceFlow.id);
    }
  });

  it('Should return an empty Array for a FlowNode that doesn\'t have any outgoing SequenceFlows.', async (): Promise<void> => {

    const flowNodeId = 'EndEvent_Subprocess';

    const sequenceFlows = subProcessModelFacade.getOutgoingSequenceFlowsFor(flowNodeId);

    should(sequenceFlows).be.instanceOf(Array);
    should(sequenceFlows.length).be.equal(0);
  });

  it('Should throw an error, if the given FlowNodeID is invalid.', async (): Promise<void> => {
    try {
      const sequenceFlows = subProcessModelFacade.getOutgoingSequenceFlowsFor('SomeInvalidId');
      should.fail(sequenceFlows, undefined, 'This should not have worked, because the ProcessModel has no such FlowNode!');
    } catch (error) {
      should(error.message).be.match(/not found/i);
    }
  });

  it('Should throw an error, if the given FlowNodeID is valid, but is located outside the SubProcess.', async (): Promise<void> => {
    try {
      const sequenceFlows = subProcessModelFacade.getOutgoingSequenceFlowsFor('EndEvent_1');
      should.fail(sequenceFlows, undefined, 'This should not have worked, because the ProcessModel has no such FlowNode!');
    } catch (error) {
      should(error.message).be.match(/not found/i);
    }
  });
});
