import * as should from 'should';

import {SubProcessModelFacade} from '../../../src/runtime/facades/sub_process_model_facade';
import {TestFixtureProvider} from '../../test_fixture_provider';

describe('SubProcessModelFacade.getPreviousFlowNodesFor', (): void => {

  let fixtureProvider: TestFixtureProvider;

  let subProcessModelFacade: SubProcessModelFacade;

  before(async (): Promise<void> => {
    fixtureProvider = new TestFixtureProvider();
    await fixtureProvider.initialize();

    subProcessModelFacade = await fixtureProvider.createSubProcessModelFacade();
  });

  it('Should return a single preceeding FlowNode for a FlowNode that has one incoming SequenceFlow.', async (): Promise<void> => {

    const endEventId = 'EndEvent_Subprocess';
    const endEvent = subProcessModelFacade.getFlowNodeById(endEventId);

    const previousFlowNodes = subProcessModelFacade.getPreviousFlowNodesFor(endEvent);

    const expectedPreviousFlowNodeId = 'ExclusiveJoinGateway_SubProcess';

    should(previousFlowNodes).be.instanceOf(Array);
    should(previousFlowNodes.length).be.equal(1);
    should(previousFlowNodes[0].id).be.equal(expectedPreviousFlowNodeId);
  });

  it('Should return a list of preceeding FlowNodes for a Gateway with multiple incoming SequenceFlows.', async (): Promise<void> => {

    const flowNodeId = 'ExclusiveJoinGateway_SubProcess';
    const flowNode = subProcessModelFacade.getFlowNodeById(flowNodeId);

    const previousFlowNodes = subProcessModelFacade.getPreviousFlowNodesFor(flowNode);

    should(previousFlowNodes).be.instanceOf(Array);
    should(previousFlowNodes.length).be.equal(3);

    const expectedNextFlowNodeIds = [
      'UserTask_1',
      'UserTask_2',
      'UserTask_Invalid',
    ];

    for (const previousFlowNode of previousFlowNodes) {
      should(expectedNextFlowNodeIds).containEql(previousFlowNode.id);
    }
  });

  it('Should return a single preceeding FlowNode for a FlowNode that is connected to a BoundaryEvent.', async (): Promise<void> => {

    const endEventId = 'EndEvent_2';
    const endEvent = subProcessModelFacade.getFlowNodeById(endEventId);

    const previousFlowNodes = subProcessModelFacade.getPreviousFlowNodesFor(endEvent);

    const expectedPreviousFlowNodeId = 'UserTask_2';

    should(previousFlowNodes).be.instanceOf(Array);
    should(previousFlowNodes.length).be.equal(1);
    should(previousFlowNodes[0].id).be.equal(expectedPreviousFlowNodeId);
  });

  it('Should return undefined for a FlowNode that has no incoming SequenceFlow.', async (): Promise<void> => {

    const startEventId = 'StartEvent_SubProcess';
    const startEvent = subProcessModelFacade.getFlowNodeById(startEventId);

    const flowNodes = subProcessModelFacade.getPreviousFlowNodesFor(startEvent);

    should(flowNodes).be.undefined();
  });

  it('Should not throw an error, when backtracking to a misconfigured FlowNode with multiple outgoing SequenceFlows.', async (): Promise<void> => {

    const taskId = 'EndEvent_3';
    const task = subProcessModelFacade.getFlowNodeById(taskId);

    const previousFlowNodes = subProcessModelFacade.getPreviousFlowNodesFor(task);

    const expectedPreviousFlowNodeId = 'UserTask_Invalid';

    should(previousFlowNodes).be.instanceOf(Array);
    should(previousFlowNodes.length).be.equal(1);
    should(previousFlowNodes[0].id).be.equal(expectedPreviousFlowNodeId);
  });
});
