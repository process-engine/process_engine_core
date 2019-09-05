import * as should from 'should';

import {SubProcessModelFacade} from '../../../src/runtime/facades/sub_process_model_facade';
import {TestFixtureProvider} from '../../test_fixture_provider';

describe('SubProcessModelFacade.getFlowNodeById', (): void => {

  let fixtureProvider: TestFixtureProvider;
  let subProcessModelFacade: SubProcessModelFacade;

  before(async (): Promise<void> => {
    fixtureProvider = new TestFixtureProvider();
    await fixtureProvider.initialize();

    subProcessModelFacade = await fixtureProvider.createSubProcessModelFacade();
  });

  it('Should be able to return each FlowNode of the attached SubProcess.', async (): Promise<void> => {

    const expectedFlowNodeIds = [
      'StartEvent_SubProcess',
      'ExclusiveSplitGateway_SubProcess',
      'UserTask_1',
      'UserTask_2',
      'UserTask_Invalid',
      'ExclusiveJoinGateway_SubProcess',
      'EndEvent_Subprocess',
      'EndEvent_2',
      'EndEvent_3',
    ];

    for (const expectedId of expectedFlowNodeIds) {
      const flowNode = subProcessModelFacade.getFlowNodeById(expectedId);
      should.exist(flowNode, `The Facade was unable to find the FlowNode '${expectedId}'!`);
      should(flowNode.id).be.equal(expectedId, `The Facade returned an incorrect FlowNode! Expected ${expectedId}, but got ${flowNode.id}!`);
    }
  });

  it('Should not be able to return any of the FlowNodes that lie outside of the Subprocess.', async (): Promise<void> => {

    const expectedFlowNodeIds = [
      'StartEvent_1',
      'SubProcess1',
      'EndEvent_1',
    ];

    for (const inaccessibleId of expectedFlowNodeIds) {
      const flowNode = subProcessModelFacade.getFlowNodeById(inaccessibleId);
      should.not.exist(flowNode, `The SubProcessModelFacade could access the FlowNode '${inaccessibleId}', which lies outside of the Subprocess!`);
    }
  });

  it('Should return undefined, if the FlowNode does not exist.', async (): Promise<void> => {
    const flowNode = subProcessModelFacade.getFlowNodeById('randomInvalidId');
    should.not.exist(flowNode, 'The SubProcessModelFacade did not return undefined upon querying an invalid ID!');
  });
});
