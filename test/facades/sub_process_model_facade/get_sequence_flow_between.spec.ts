import * as should from 'should';

import {Model} from '@process-engine/persistence_api.contracts';

import {SubProcessModelFacade} from '../../../src/runtime/facades/sub_process_model_facade';
import {TestFixtureProvider} from '../../test_fixture_provider';

describe('SubProcessModelFacade.getSequenceFlowBetween', (): void => {

  let fixtureProvider: TestFixtureProvider;

  let subProcessModelFacade: SubProcessModelFacade;

  before(async (): Promise<void> => {
    fixtureProvider = new TestFixtureProvider();
    await fixtureProvider.initialize();

    subProcessModelFacade = await fixtureProvider.createSubProcessModelFacade();
  });

  it('Should correctly return the SequenceFlow between FlowNode A and FlowNode B, when they are connected directly.', async (): Promise<void> => {

    const flowNode1 = subProcessModelFacade.getFlowNodeById('ExclusiveJoinGateway_SubProcess');
    const flowNode2 = subProcessModelFacade.getFlowNodeById('EndEvent_Subprocess');
    const expectedSequenceFlowId = 'SequenceFlow_0tofni9';

    const sequenceFlow = subProcessModelFacade.getSequenceFlowBetween(flowNode1, flowNode2);

    should(sequenceFlow).be.instanceOf(Model.ProcessElements.SequenceFlow);
    should(sequenceFlow.id).be.equal(expectedSequenceFlowId);
  });

  // eslint-disable-next-line max-len
  it('Should correctly return the SequenceFlow between FlowNode A and FlowNode B, when they are connected through a BoundaryEvent.', async (): Promise<void> => {

    const flowNode1 = subProcessModelFacade.getFlowNodeById('UserTask_2');
    const flowNode2 = subProcessModelFacade.getFlowNodeById('EndEvent_2');
    const expectedSequenceFlowId = 'SequenceFlow_0hf53tf';

    const sequenceFlow = subProcessModelFacade.getSequenceFlowBetween(flowNode1, flowNode2);

    should(sequenceFlow).be.instanceOf(Model.ProcessElements.SequenceFlow);
    should(sequenceFlow.id).be.equal(expectedSequenceFlowId);
  });

  it('Should return undefined, if the FlowNodes are not connected directly.', async (): Promise<void> => {

    const flowNode1 = subProcessModelFacade.getFlowNodeById('ExclusiveSplitGateway_SubProcess');
    const flowNode2 = subProcessModelFacade.getFlowNodeById('ExclusiveJoinGateway_SubProcess');

    const sequenceFlow = subProcessModelFacade.getSequenceFlowBetween(flowNode1, flowNode2);

    should(sequenceFlow).be.undefined();
  });

  it('Should return undefined, if the FlowNodes are passed in the wrong order.', async (): Promise<void> => {

    const flowNode1 = subProcessModelFacade.getFlowNodeById('UserTask_2');
    const flowNode2 = subProcessModelFacade.getFlowNodeById('EndEvent_2');

    const sequenceFlow = subProcessModelFacade.getSequenceFlowBetween(flowNode2, flowNode1);

    should(sequenceFlow).be.undefined();
  });

  it('Should return undefined, if both FlowNodes are identical.', async (): Promise<void> => {

    const flowNode1 = subProcessModelFacade.getFlowNodeById('EndEvent_2');

    const sequenceFlow = subProcessModelFacade.getSequenceFlowBetween(flowNode1, flowNode1);

    should(sequenceFlow).be.undefined();
  });

  it('Should return undefined, if FlowNode A is undefined.', async (): Promise<void> => {

    const flowNode2 = subProcessModelFacade.getFlowNodeById('EndEvent_2');

    const sequenceFlow = subProcessModelFacade.getSequenceFlowBetween(undefined, flowNode2);

    should(sequenceFlow).be.undefined();
  });

  it('Should return undefined, if FlowNode B is undefined.', async (): Promise<void> => {

    const flowNode1 = subProcessModelFacade.getFlowNodeById('UserTask_2');

    const sequenceFlow = subProcessModelFacade.getSequenceFlowBetween(flowNode1, undefined);

    should(sequenceFlow).be.undefined();
  });

  it('Should return undefined, if FlowNode A does not exist within the Subprocess.', async (): Promise<void> => {

    const flowNode1 = {id: 'some non-existing flownode'};
    const flowNode2 = subProcessModelFacade.getFlowNodeById('EndEvent_2');

    const sequenceFlow = subProcessModelFacade.getSequenceFlowBetween(flowNode1 as any, flowNode2);

    should(sequenceFlow).be.undefined();
  });

  it('Should return undefined, if FlowNode B does not exist within the Subprocess.', async (): Promise<void> => {

    const flowNode1 = subProcessModelFacade.getFlowNodeById('UserTask_2');
    const flowNode2 = {id: 'some non-existing flownode'};

    const sequenceFlow = subProcessModelFacade.getSequenceFlowBetween(flowNode1, flowNode2 as any);

    should(sequenceFlow).be.undefined();
  });
});
