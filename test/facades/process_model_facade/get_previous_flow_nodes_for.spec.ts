import * as should from 'should';

import {ProcessModelFacade} from '../../../src/runtime/facades/process_model_facade';
import {TestFixtureProvider} from '../../test_fixture_provider';

describe('ProcessModelFacade.getPreviousFlowNodesFor', (): void => {

  let fixtureProvider: TestFixtureProvider;

  let processModelFacade: ProcessModelFacade;

  before(async (): Promise<void> => {
    fixtureProvider = new TestFixtureProvider();
    await fixtureProvider.initialize();

    const processModelFilePath = 'process_with_boundary_events.bpmn';
    const parsedProcessModel = await fixtureProvider.parseProcessModelFromFile(processModelFilePath);

    processModelFacade = fixtureProvider.createProcessModelFacade(parsedProcessModel);
  });

  it('Should return a single preceeding FlowNode for a FlowNode that has one incoming SequenceFlow.', async (): Promise<void> => {

    const endEventId = 'EndEvent_Regular';
    const endEvent = processModelFacade.getFlowNodeById(endEventId);

    const nextFlowNodes = processModelFacade.getPreviousFlowNodesFor(endEvent);

    const expectedPreviousFlowNodeId = 'ThrowMessageConfirmManualTaskFinished';

    should(nextFlowNodes).be.instanceOf(Array);
    should(nextFlowNodes.length).be.equal(1);
    should(nextFlowNodes[0].id).be.equal(expectedPreviousFlowNodeId);
  });

  it('Should return a single preceeding FlowNode for a FlowNode that is connected to a BoundaryEvent.', async (): Promise<void> => {

    const endEventId = 'ThrowMessageConfirmSignalReceived';
    const endEvent = processModelFacade.getFlowNodeById(endEventId);

    const nextFlowNodes = processModelFacade.getPreviousFlowNodesFor(endEvent);

    const expectedPreviousFlowNodeId = 'ManualTask123';

    should(nextFlowNodes).be.instanceOf(Array);
    should(nextFlowNodes.length).be.equal(1);
    should(nextFlowNodes[0].id).be.equal(expectedPreviousFlowNodeId);
  });

  it('Should return undefined for a FlowNode that has no incoming SequenceFlow.', async (): Promise<void> => {

    const startEventId = 'StartEvent_1';
    const startEvent = processModelFacade.getFlowNodeById(startEventId);

    const flowNodes = processModelFacade.getPreviousFlowNodesFor(startEvent);

    should(flowNodes).be.undefined();
  });
});
