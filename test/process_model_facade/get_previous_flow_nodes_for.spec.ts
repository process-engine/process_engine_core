import * as should from 'should';

import {Model} from '@process-engine/process_model.contracts';

import {ProcessModelFacade} from '../../src/runtime/facades/process_model_facade';
import {TestFixtureProvider} from '../test_fixture_provider';

describe('ProcessModelFacade.getPreviousFlowNodesFor', () => {

  let fixtureProvider: TestFixtureProvider;

  let processModelFacade: ProcessModelFacade;

  before(async() => {
    fixtureProvider = new TestFixtureProvider();
    await fixtureProvider.initialize();

    const processModelFilePath: string = './test/bpmns/process_with_boundary_events.bpmn';
    const parsedProcessModel: Model.Process = await fixtureProvider.parseProcessModelFromFile(processModelFilePath);

    processModelFacade = fixtureProvider.createProcessModelFacade(parsedProcessModel);
  });

  const flowNodeIds: Array<string> = [
    'ValidTask',
    'StartEvent_1',
    'ExclusiveGateway_0a4jn5v',
    'InvalidTask',
    'EndEvent_1',
    'EndEvent_2',
    'EndEvent_3',
  ];

  it('should return a single preceeding FlowNode for a FlowNode that has one incoming SequenceFlow.', async() => {

    const endEventId: string = 'EndEvent_Regular';
    const endEvent: Model.Base.FlowNode = processModelFacade.getFlowNodeById(endEventId);

    const nextFlowNodes: Array<Model.Base.FlowNode> = processModelFacade.getPreviousFlowNodesFor(endEvent);

    const expectedPreviousFlowNodeId: string = 'ThrowMessageConfirmManualTaskFinished';

    should(nextFlowNodes).be.instanceOf(Array);
    should(nextFlowNodes.length).be.equal(1);
    should(nextFlowNodes[0].id).be.equal(expectedPreviousFlowNodeId);
  });

  it('should return a single preceeding FlowNode for a FlowNode that is connected to a BoundaryEvent.', async() => {

    const endEventId: string = 'ThrowMessageConfirmSignalReceived';
    const endEvent: Model.Base.FlowNode = processModelFacade.getFlowNodeById(endEventId);

    const nextFlowNodes: Array<Model.Base.FlowNode> = processModelFacade.getPreviousFlowNodesFor(endEvent);

    const expectedPreviousFlowNodeId: string = 'ManualTask123';

    should(nextFlowNodes).be.instanceOf(Array);
    should(nextFlowNodes.length).be.equal(1);
    should(nextFlowNodes[0].id).be.equal(expectedPreviousFlowNodeId);
  });

  it('should return undefined for a FlowNode that has no incoming SequenceFlow.', async() => {

    const startEventId: string = 'StartEvent_1';
    const startEvent: Model.Base.FlowNode = processModelFacade.getFlowNodeById(startEventId);

    const flowNodes: Array<Model.Base.FlowNode> = processModelFacade.getPreviousFlowNodesFor(startEvent);

    should(flowNodes).be.undefined();
  });
});
