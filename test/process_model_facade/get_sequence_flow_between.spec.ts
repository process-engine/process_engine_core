import * as should from 'should';

import {Model} from '@process-engine/process_model.contracts';

import {ProcessModelFacade} from '../../src/runtime/facades/process_model_facade';
import {TestFixtureProvider} from '../test_fixture_provider';

describe('ProcessModelFacade.getSequenceFlowBetween', () => {

  let fixtureProvider: TestFixtureProvider;

  let processModelFacade: ProcessModelFacade;

  before(async() => {
    fixtureProvider = new TestFixtureProvider();
    await fixtureProvider.initialize();

    const processModelFilePath: string = './test/bpmns/process_engine_io_release.bpmn';
    const parsedProcessModel: Model.Process = await fixtureProvider.parseProcessModelFromFile(processModelFilePath);

    processModelFacade = fixtureProvider.createProcessModelFacade(parsedProcessModel);
  });

  it('should correctly return the SequenceFlow between FlowNode A and FlowNode B, when they are connected directly.', async() => {

    const flowNode1: Model.Base.FlowNode = processModelFacade.getFlowNodeById('ExclusiveSplitGateway_1');
    const flowNode2: Model.Base.FlowNode = processModelFacade.getFlowNodeById('EndEvent_0y6uwzm');
    const expectedSequenceFlowId: string = 'SequenceFlow_1ukf8v1';

    const sequenceFlow: Model.ProcessElements.SequenceFlow = processModelFacade.getSequenceFlowBetween(flowNode1, flowNode2);

    should(sequenceFlow).be.instanceOf(Model.ProcessElements.SequenceFlow);
    should(sequenceFlow.id).be.equal(expectedSequenceFlowId);
  });

  it('should correctly return the SequenceFlow between FlowNode A and FlowNode B, when they are connected through a BoundaryEvent.', async() => {

    const processModelFilePath2: string = './test/bpmns/process_with_boundary_events.bpmn';
    const parsedProcessModel: Model.Process = await fixtureProvider.parseProcessModelFromFile(processModelFilePath2);
    const processModelFacade2: ProcessModelFacade = fixtureProvider.createProcessModelFacade(parsedProcessModel);

    const flowNode1: Model.Base.FlowNode = processModelFacade2.getFlowNodeById('ManualTask123');
    const flowNode2: Model.Base.FlowNode = processModelFacade2.getFlowNodeById('ThrowMessageConfirmSignalReceived');
    const expectedSequenceFlowId: string = 'SequenceFlow_115y68b';

    const sequenceFlow: Model.ProcessElements.SequenceFlow = processModelFacade2.getSequenceFlowBetween(flowNode1, flowNode2);

    should(sequenceFlow).be.instanceOf(Model.ProcessElements.SequenceFlow);
    should(sequenceFlow.id).be.equal(expectedSequenceFlowId);
  });

  it('should return undefined, if the FlowNodes are passed in the wrong order.', async() => {

    const flowNode1: Model.Base.FlowNode = processModelFacade.getFlowNodeById('ExclusiveSplitGateway_1');
    const flowNode2: Model.Base.FlowNode = processModelFacade.getFlowNodeById('EndEvent_0y6uwzm');

    const sequenceFlow: Model.ProcessElements.SequenceFlow = processModelFacade.getSequenceFlowBetween(flowNode2, flowNode1);

    should(sequenceFlow).be.undefined();
  });

  it('should return undefined, if both FlowNodes are identical.', async() => {

    const flowNode1: Model.Base.FlowNode = processModelFacade.getFlowNodeById('ExclusiveSplitGateway_1');

    const sequenceFlow: Model.ProcessElements.SequenceFlow = processModelFacade.getSequenceFlowBetween(flowNode1, flowNode1);

    should(sequenceFlow).be.undefined();
  });

  it('should return undefined, if FlowNode A is undefined.', async() => {

    const flowNode2: Model.Base.FlowNode = processModelFacade.getFlowNodeById('EndEvent_0y6uwzm');

    const sequenceFlow: Model.ProcessElements.SequenceFlow = processModelFacade.getSequenceFlowBetween(undefined, flowNode2);

    should(sequenceFlow).be.undefined();
  });

  it('should return undefined, if FlowNode B is undefined.', async() => {

    const flowNode1: Model.Base.FlowNode = processModelFacade.getFlowNodeById('ExclusiveSplitGateway_1');

    const sequenceFlow: Model.ProcessElements.SequenceFlow = processModelFacade.getSequenceFlowBetween(flowNode1, undefined);

    should(sequenceFlow).be.undefined();
  });

  it('should return undefined, if FlowNode A is does not exist on the ProcessModel.', async() => {

    const flowNode1: any = {id: 'some non-existing flownode'};
    const flowNode2: Model.Base.FlowNode = processModelFacade.getFlowNodeById('EndEvent_0y6uwzm');

    const sequenceFlow: Model.ProcessElements.SequenceFlow = processModelFacade.getSequenceFlowBetween(flowNode1, flowNode2);

    should(sequenceFlow).be.undefined();
  });

  it('should return undefined, if FlowNode B does not exist on the ProcessModel.', async() => {

    const flowNode1: Model.Base.FlowNode = processModelFacade.getFlowNodeById('ExclusiveSplitGateway_1');
    const flowNode2: any = {id: 'some non-existing flownode'};

    const sequenceFlow: Model.ProcessElements.SequenceFlow = processModelFacade.getSequenceFlowBetween(flowNode1, flowNode2);

    should(sequenceFlow).be.undefined();
  });
});
