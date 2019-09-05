import * as should from 'should';

import {ProcessModelFacade} from '../../../src/runtime/facades/process_model_facade';
import {TestFixtureProvider} from '../../test_fixture_provider';

describe('ProcessModelFacade.getNextFlowNodesFor', (): void => {

  let fixtureProvider: TestFixtureProvider;

  let processModelFacade: ProcessModelFacade;

  before(async (): Promise<void> => {
    fixtureProvider = new TestFixtureProvider();
    await fixtureProvider.initialize();

    const processModelFilePath = 'diagram_with_invalid_task_configs.bpmn';
    const parsedProcessModel = await fixtureProvider.parseProcessModelFromFile(processModelFilePath);

    processModelFacade = fixtureProvider.createProcessModelFacade(parsedProcessModel);
  });

  it('Should return a single succeeding FlowNode for a FlowNode that has one outgoing SequenceFlow.', async (): Promise<void> => {

    const startEventId = 'StartEvent_1';
    const startEvent = processModelFacade.getFlowNodeById(startEventId);

    const nextFlowNodes = processModelFacade.getNextFlowNodesFor(startEvent);

    const expectedNextFlowNodeId = 'ExclusiveGateway_0a4jn5v';

    should(nextFlowNodes).be.instanceOf(Array);
    should(nextFlowNodes.length).be.equal(1);
    should(nextFlowNodes[0].id).be.equal(expectedNextFlowNodeId);
  });

  it('Should return a list of succeeding FlowNodes for a Gateway with multiple outgoing SequenceFlows.', async (): Promise<void> => {

    const flowNodeId = 'ExclusiveGateway_0a4jn5v';
    const flowNode = processModelFacade.getFlowNodeById(flowNodeId);

    const nextFlowNodes = processModelFacade.getNextFlowNodesFor(flowNode);

    should(nextFlowNodes).be.instanceOf(Array);
    should(nextFlowNodes.length).be.equal(2);

    const expectedNextFlowNodeIds = [
      'ValidTask',
      'InvalidTask',
    ];

    for (const nextFlowNode of nextFlowNodes) {
      should(expectedNextFlowNodeIds).containEql(nextFlowNode.id);
    }
  });

  it('Should return undefined for a FlowNode that has no outgoing SequenceFlow.', async (): Promise<void> => {

    const endEventId = 'EndEvent_1';
    const endEvent = processModelFacade.getFlowNodeById(endEventId);

    const flowNodes = processModelFacade.getNextFlowNodesFor(endEvent);

    should(flowNodes).be.undefined();
  });

  it('Should throw an error for a FlowNode that has multiple outgoing SequenceFlows, but is not a gateway.', async (): Promise<void> => {

    const invalidTaskId = 'InvalidTask';
    const invalidTask = processModelFacade.getFlowNodeById(invalidTaskId);

    try {
      const flowNodes = processModelFacade.getNextFlowNodesFor(invalidTask);
      should.fail(flowNodes, undefined, 'This should have caused an error, because multiple outgoing SequenceFlows are not allowed!');
    } catch (error) {
      const expectedErrorMessage = /flowNode.*?has more than one outgoing sequenceflow/i;
      const expectedErrorCode = 500;
      should(error.message).be.match(expectedErrorMessage);
      should(error.code).be.equal(expectedErrorCode);
    }
  });
});
