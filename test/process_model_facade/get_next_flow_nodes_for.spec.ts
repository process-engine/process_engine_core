import * as should from 'should';

import {Model} from '@process-engine/process_model.contracts';

import {ProcessModelFacade} from '../../src/runtime/facades/process_model_facade';
import {TestFixtureProvider} from '../test_fixture_provider';

describe('ProcessModelFacade.getNextFlowNodesFor', () => {

  let fixtureProvider: TestFixtureProvider;

  let processModelFacade: ProcessModelFacade;

  before(async() => {
    fixtureProvider = new TestFixtureProvider();
    await fixtureProvider.initialize();

    const processModelFilePath: string = './test/bpmns/diagram_with_invalid_task_configs.bpmn';
    const parsedProcessModel: Model.Process = await fixtureProvider.parseProcessModelFromFile(processModelFilePath);

    processModelFacade = fixtureProvider.createProcessModelFacade(parsedProcessModel);
  });

  it('should return a single succeeding FlowNode for a FlowNode that has one outgoing SequenceFlow.', async() => {

    const startEventId: string = 'StartEvent_1';
    const startEvent: Model.Base.FlowNode = processModelFacade.getFlowNodeById(startEventId);

    const nextFlowNodes: Array<Model.Base.FlowNode> = processModelFacade.getNextFlowNodesFor(startEvent);

    const expectedNextFlowNodeId: string = 'ExclusiveGateway_0a4jn5v';

    should(nextFlowNodes).be.instanceOf(Array);
    should(nextFlowNodes.length).be.equal(1);
    should(nextFlowNodes[0].id).be.equal(expectedNextFlowNodeId);
  });

  it('should return a list of succeeding FlowNodes for a Gateway with multiple outgoing SequenceFlows.', async() => {

    const flowNodeId: string = 'ExclusiveGateway_0a4jn5v';
    const flowNode: Model.Base.FlowNode = processModelFacade.getFlowNodeById(flowNodeId);

    const nextFlowNodes: Array<Model.Base.FlowNode> = processModelFacade.getNextFlowNodesFor(flowNode);

    should(nextFlowNodes).be.instanceOf(Array);
    // tslint:disable-next-line:no-magic-numbers
    should(nextFlowNodes.length).be.equal(2);

    const expectedNextFlowNodeIds: Array<string> = [
      'ValidTask',
      'InvalidTask',
    ];

    for (const nextFlowNode of nextFlowNodes) {
      should(expectedNextFlowNodeIds).containEql(nextFlowNode.id);
    }
  });

  it('should return undefined for a FlowNode that has no outgoing SequenceFlow.', async() => {

    const endEventId: string = 'EndEvent_1';
    const endEvent: Model.Base.FlowNode = processModelFacade.getFlowNodeById(endEventId);

    const flowNodes: Array<Model.Base.FlowNode> = processModelFacade.getNextFlowNodesFor(endEvent);

    should(flowNodes).be.undefined();
  });

  it('should throw an error for a FlowNode that has multiple outgoing SequenceFlows, but is not a gateway.', async() => {

    const invalidTaskId: string = 'InvalidTask';
    const invalidTask: Model.Base.FlowNode = processModelFacade.getFlowNodeById(invalidTaskId);

    try {
      const flowNodes: Array<Model.Base.FlowNode> = processModelFacade.getNextFlowNodesFor(invalidTask);
      should.fail(flowNodes, undefined, 'This should have caused an error, because multiple outgoing SequenceFlows are not allowed!');
    } catch (error) {
      const expectedErrorMessage: RegExp = /flowNode.*?has more than one outgoing sequenceflow/i;
      const expectedErrorCode: number = 500;
      should(error.message).be.match(expectedErrorMessage);
      should(error.code).be.equal(expectedErrorCode);
    }
  });
});
