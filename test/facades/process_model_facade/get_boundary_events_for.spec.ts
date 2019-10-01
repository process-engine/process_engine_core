import * as should from 'should';

import {Model} from '@process-engine/persistence_api.contracts';

import {ProcessModelFacade} from '../../../src/runtime/facades/process_model_facade';
import {TestFixtureProvider} from '../../test_fixture_provider';

describe('ProcessModelFacade.getBoundaryEventsFor', (): void => {

  let fixtureProvider: TestFixtureProvider;
  let processModelFacade: ProcessModelFacade;

  before(async (): Promise<void> => {
    fixtureProvider = new TestFixtureProvider();
    await fixtureProvider.initialize();

    const processModelFilePath = 'process_with_boundary_events.bpmn';
    const parsedProcessModel = await fixtureProvider.parseProcessModelFromFile(processModelFilePath);
    processModelFacade = fixtureProvider.createProcessModelFacade(parsedProcessModel);
  });

  it('Should return all BoundaryEvents of the given decorated ManualTask.', async (): Promise<void> => {

    const flowNodeWithOutBoundaryEvents = processModelFacade.getFlowNodeById('ManualTask123');

    const boundaryEvents = processModelFacade.getBoundaryEventsFor(flowNodeWithOutBoundaryEvents);
    should(boundaryEvents).be.instanceOf(Array);
    should(boundaryEvents.length).be.equal(3);

    const expectedBoundaryEventIds = [
      'SignalBoundaryEvent_1',
      'TimerBoundaryEvent_1',
      'MessageBoundaryEvent_1',
    ];

    for (const expectedId of expectedBoundaryEventIds) {
      const boundaryEventExists = boundaryEvents.some((boundaryEvent: Model.Events.BoundaryEvent): boolean => boundaryEvent.id === expectedId);
      should(boundaryEventExists).be.true(`The BoundaryEventList should have contained an event with ID '${expectedId}', but none was found!`);
    }
  });

  it('Should return an empty list for FlowNodes that have no BoundaryEvents.', async (): Promise<void> => {

    const flowNodeWithOutBoundaryEvents = processModelFacade.getFlowNodeById('StartEvent_1');

    const boundaryEvents = processModelFacade.getBoundaryEventsFor(flowNodeWithOutBoundaryEvents);
    should(boundaryEvents).be.instanceOf(Array);
    should(boundaryEvents.length).be.equal(0, 'The BoundaryEvent list should have been empty, because the FlowNode doesn\'t have any!');
  });

  it('Should return an empty list, when the ID of a non-existing FlowNode is used.', async (): Promise<void> => {

    const dummyData: any = {
      id: 'some non-existing flow node',
    };

    const boundaryEvents = processModelFacade.getBoundaryEventsFor(dummyData);
    should(boundaryEvents).be.instanceOf(Array);
    should(boundaryEvents.length).be.equal(0, 'The BoundaryEvent list should have been empty, because the FlowNode doesn\'t have any!');
  });
});
