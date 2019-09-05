import * as should from 'should';

import {SubProcessModelFacade} from '../../../src/runtime/facades/sub_process_model_facade';
import {TestFixtureProvider} from '../../test_fixture_provider';

describe('SubProcessModelFacade.getNextFlowNodesFor', (): void => {

  let fixtureProvider: TestFixtureProvider;

  let subProcessModelFacade: SubProcessModelFacade;

  before(async (): Promise<void> => {
    fixtureProvider = new TestFixtureProvider();
    await fixtureProvider.initialize();

    subProcessModelFacade = await fixtureProvider.createSubProcessModelFacade();
  });

  it('Should return a single succeeding FlowNode for a FlowNode that has one outgoing SequenceFlow.', async (): Promise<void> => {

    const startEventId = 'StartEvent_SubProcess';
    const startEvent = subProcessModelFacade.getFlowNodeById(startEventId);

    const nextFlowNodes = subProcessModelFacade.getNextFlowNodesFor(startEvent);

    const expectedNextFlowNodeId = 'ExclusiveSplitGateway_SubProcess';

    should(nextFlowNodes).be.instanceOf(Array);
    should(nextFlowNodes.length).be.equal(1);
    should(nextFlowNodes[0].id).be.equal(expectedNextFlowNodeId);
  });

  it('Should return a list of succeeding FlowNodes for a Gateway with multiple outgoing SequenceFlows.', async (): Promise<void> => {

    const flowNodeId = 'ExclusiveSplitGateway_SubProcess';
    const flowNode = subProcessModelFacade.getFlowNodeById(flowNodeId);

    const nextFlowNodes = subProcessModelFacade.getNextFlowNodesFor(flowNode);

    should(nextFlowNodes).be.instanceOf(Array);
    should(nextFlowNodes.length).be.equal(3);

    const expectedNextFlowNodeIds = [
      'UserTask_1',
      'UserTask_2',
      'UserTask_Invalid',
    ];

    for (const nextFlowNode of nextFlowNodes) {
      should(expectedNextFlowNodeIds).containEql(nextFlowNode.id);
    }
  });

  it('Should return undefined for a FlowNode that has no outgoing SequenceFlow.', async (): Promise<void> => {

    const endEventId = 'EndEvent_Subprocess';
    const endEvent = subProcessModelFacade.getFlowNodeById(endEventId);

    const flowNodes = subProcessModelFacade.getNextFlowNodesFor(endEvent);

    should(flowNodes).be.undefined();
  });

  it('Should throw an error for a FlowNode that has multiple outgoing SequenceFlows, but is not a gateway.', async (): Promise<void> => {

    const invalidTaskId = 'UserTask_Invalid';
    const invalidTask = subProcessModelFacade.getFlowNodeById(invalidTaskId);

    try {
      const flowNodes = subProcessModelFacade.getNextFlowNodesFor(invalidTask);
      should.fail(flowNodes, undefined, 'This should have caused an error, because multiple outgoing SequenceFlows are not allowed!');
    } catch (error) {
      const expectedErrorMessage = /flowNode.*?has more than one outgoing sequenceflow/i;
      const expectedErrorCode = 500;
      should(error.message).be.match(expectedErrorMessage);
      should(error.code).be.equal(expectedErrorCode);
    }
  });
});
