import * as should from 'should';

import {Model} from '@process-engine/persistence_api.contracts';

import {ProcessModelFacade} from '../../../src/runtime/facades/process_model_facade';
import {TestFixtureProvider} from '../../test_fixture_provider';

describe('ProcessModelFacade.getSequenceFlowBetween', (): void => {

  let fixtureProvider: TestFixtureProvider;

  let processModelFacade: ProcessModelFacade;

  before(async (): Promise<void> => {
    fixtureProvider = new TestFixtureProvider();
    await fixtureProvider.initialize();

    const processModelFilePath = 'process_engine_io_release.bpmn';
    const parsedProcessModel = await fixtureProvider.parseProcessModelFromFile(processModelFilePath);

    processModelFacade = fixtureProvider.createProcessModelFacade(parsedProcessModel);
  });

  it('Should correctly return the SequenceFlow between FlowNode A and FlowNode B, when they are connected directly.', async (): Promise<void> => {

    const flowNode1 = processModelFacade.getFlowNodeById('ExclusiveSplitGateway_1');
    const flowNode2 = processModelFacade.getFlowNodeById('EndEvent_0y6uwzm');
    const expectedSequenceFlowId = 'SequenceFlow_1ukf8v1';

    const sequenceFlow = processModelFacade.getSequenceFlowBetween(flowNode1, flowNode2);

    should(sequenceFlow).be.instanceOf(Model.ProcessElements.SequenceFlow);
    should(sequenceFlow.id).be.equal(expectedSequenceFlowId);
  });

  // eslint-disable-next-line max-len
  it('Should correctly return the SequenceFlow between FlowNode A and FlowNode B, when they are connected through a BoundaryEvent.', async (): Promise<void> => {

    const processModelFilePath2 = 'process_with_boundary_events.bpmn';
    const parsedProcessModel = await fixtureProvider.parseProcessModelFromFile(processModelFilePath2);
    const processModelFacade2 = fixtureProvider.createProcessModelFacade(parsedProcessModel);

    const flowNode1 = processModelFacade2.getFlowNodeById('ManualTask123');
    const flowNode2 = processModelFacade2.getFlowNodeById('ThrowMessageConfirmSignalReceived');
    const expectedSequenceFlowId = 'SequenceFlow_115y68b';

    const sequenceFlow = processModelFacade2.getSequenceFlowBetween(flowNode1, flowNode2);

    should(sequenceFlow).be.instanceOf(Model.ProcessElements.SequenceFlow);
    should(sequenceFlow.id).be.equal(expectedSequenceFlowId);
  });

  it('Should return undefined, if the FlowNodes are passed in the wrong order.', async (): Promise<void> => {

    const flowNode1 = processModelFacade.getFlowNodeById('ExclusiveSplitGateway_1');
    const flowNode2 = processModelFacade.getFlowNodeById('EndEvent_0y6uwzm');

    const sequenceFlow = processModelFacade.getSequenceFlowBetween(flowNode2, flowNode1);

    should(sequenceFlow).be.undefined();
  });

  it('Should return undefined, if both FlowNodes are identical.', async (): Promise<void> => {

    const flowNode1 = processModelFacade.getFlowNodeById('ExclusiveSplitGateway_1');

    const sequenceFlow = processModelFacade.getSequenceFlowBetween(flowNode1, flowNode1);

    should(sequenceFlow).be.undefined();
  });

  it('Should return undefined, if FlowNode A is undefined.', async (): Promise<void> => {

    const flowNode2 = processModelFacade.getFlowNodeById('EndEvent_0y6uwzm');

    const sequenceFlow = processModelFacade.getSequenceFlowBetween(undefined, flowNode2);

    should(sequenceFlow).be.undefined();
  });

  it('Should return undefined, if FlowNode B is undefined.', async (): Promise<void> => {

    const flowNode1 = processModelFacade.getFlowNodeById('ExclusiveSplitGateway_1');

    const sequenceFlow = processModelFacade.getSequenceFlowBetween(flowNode1, undefined);

    should(sequenceFlow).be.undefined();
  });

  it('Should return undefined, if FlowNode A is does not exist on the ProcessModel.', async (): Promise<void> => {

    const flowNode1 = {id: 'some non-existing flownode'};
    const flowNode2 = processModelFacade.getFlowNodeById('EndEvent_0y6uwzm');

    const sequenceFlow = processModelFacade.getSequenceFlowBetween(flowNode1 as any, flowNode2);

    should(sequenceFlow).be.undefined();
  });

  it('Should return undefined, if FlowNode B does not exist on the ProcessModel.', async (): Promise<void> => {

    const flowNode1 = processModelFacade.getFlowNodeById('ExclusiveSplitGateway_1');
    const flowNode2 = {id: 'some non-existing flownode'};

    const sequenceFlow = processModelFacade.getSequenceFlowBetween(flowNode1, flowNode2 as any);

    should(sequenceFlow).be.undefined();
  });
});
