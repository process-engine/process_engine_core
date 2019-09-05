import * as should from 'should';

import {SubProcessModelFacade} from '../../../src/runtime/facades/sub_process_model_facade';
import {TestFixtureProvider} from '../../test_fixture_provider';

describe('SubProcessModelFacade.getBoundaryEventsFor', (): void => {

  let fixtureProvider: TestFixtureProvider;
  let subProcessModelFacade: SubProcessModelFacade;

  before(async (): Promise<void> => {
    fixtureProvider = new TestFixtureProvider();
    await fixtureProvider.initialize();

    subProcessModelFacade = await fixtureProvider.createSubProcessModelFacade();
  });

  it('Should return all BoundaryEvents of the given decorated UserTask.', async (): Promise<void> => {

    const flowNodeWithOutBoundaryEvents = subProcessModelFacade.getFlowNodeById('UserTask_2');

    const expectedBoundaryEventIds = 'ErrorBoundaryEvent_1';

    const boundaryEvents = subProcessModelFacade.getBoundaryEventsFor(flowNodeWithOutBoundaryEvents);
    should(boundaryEvents).be.instanceOf(Array);
    should(boundaryEvents.length).be.equal(1);
    should(boundaryEvents[0].id).be.equal(expectedBoundaryEventIds);
  });

  it('Should return an empty list for FlowNodes that have no BoundaryEvents.', async (): Promise<void> => {

    const flowNodeWithOutBoundaryEvents = subProcessModelFacade.getFlowNodeById('StartEvent_SubProcess');

    const boundaryEvents = subProcessModelFacade.getBoundaryEventsFor(flowNodeWithOutBoundaryEvents);
    should(boundaryEvents).be.instanceOf(Array);
    should(boundaryEvents.length).be.equal(0, 'The BoundaryEvent list should have been empty, because the FlowNode doesn\'t have any!');
  });
});
