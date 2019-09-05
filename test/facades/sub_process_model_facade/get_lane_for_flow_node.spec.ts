import * as should from 'should';

import {SubProcessModelFacade} from '../../../src/runtime/facades/sub_process_model_facade';
import {TestFixtureProvider} from '../../test_fixture_provider';

describe('SubProcessModelFacade.getLaneForFlowNode', (): void => {

  let fixtureProvider: TestFixtureProvider;
  let subProcessModelFacade: SubProcessModelFacade;

  before(async (): Promise<void> => {
    fixtureProvider = new TestFixtureProvider();
    await fixtureProvider.initialize();

    subProcessModelFacade = await fixtureProvider.createSubProcessModelFacade();
  });

  it('Should return the lane in which the SubProcess itself lies', async (): Promise<void> => {

    const lane = subProcessModelFacade.getLaneForFlowNode('EndEvent_Subprocess');
    should(lane.id).be.equal('Lane_1xzf0d3');
  });

  it('Should throw an error, if the given FlowNodeId is invalid', async (): Promise<void> => {

    try {
      const laneName = subProcessModelFacade.getLaneForFlowNode('SomeInvalidId');
      should.fail(laneName, undefined, 'This should not have worked, because the ProcessModel has no such FlowNode!');
    } catch (error) {
      should(error.message).be.match(/not found/i);
    }
  });

  it('Should throw an error, if the given FlowNodeId belongs to a FlowNode outside of the Subprocess', async (): Promise<void> => {

    try {
      const laneName = subProcessModelFacade.getLaneForFlowNode('EndEvent_1');
      should.fail(laneName, undefined, 'This should not have worked, because the FlowNode lies outside of the Subprocess!');
    } catch (error) {
      should(error.message).be.match(/not found/i);
    }
  });
});
