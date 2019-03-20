import * as should from 'should';

import {Model} from '@process-engine/process_model.contracts';

import {ProcessModelFacade} from '../../src/runtime/facades/process_model_facade';
import {TestFixtureProvider} from '../test_fixture_provider';

// tslint:disable:no-magic-numbers
describe('ProcessModelFacade.getBoundaryEventsFor', () => {

  let fixtureProvider: TestFixtureProvider;
  let processModelFacade: ProcessModelFacade;

  before(async() => {
    fixtureProvider = new TestFixtureProvider();
    await fixtureProvider.initialize();

    const processModelFilePath: string = './test/bpmns/process_with_boundary_events.bpmn';
    const parsedProcessModel: Model.Process = await fixtureProvider.parseProcessModelFromFile(processModelFilePath);
    processModelFacade = fixtureProvider.createProcessModelFacade(parsedProcessModel);
  });

  it('should return all BoundaryEvents of the given decorated ManualTask.', async() => {

    const flowNodeWithOutBoundaryEvents: Model.Base.FlowNode = processModelFacade.getFlowNodeById('ManualTask123');

    const boundaryEvents: Array<Model.Events.BoundaryEvent> = processModelFacade.getBoundaryEventsFor(flowNodeWithOutBoundaryEvents);
    should(boundaryEvents).be.instanceOf(Array);
    should(boundaryEvents.length).be.equal(3);

    const expectedBoundaryEventIds: Array<string> = [
      'SignalBoundaryEvent_1',
      'TimerBoundaryEvent_1',
      'MessageBoundaryEvent_1',
    ];

    for (const expectedId of expectedBoundaryEventIds) {
      const boundaryEventExists: boolean = boundaryEvents.some((boundaryEvent: Model.Events.BoundaryEvent) => boundaryEvent.id === expectedId);
      should(boundaryEventExists).be.true(`The BoundaryEventList should have contained an event with ID '${expectedId}', but none was found!`);
    }
  });

  it('should return an empty list for FlowNodes that have no BoundaryEvents.', async() => {

    const flowNodeWithOutBoundaryEvents: Model.Base.FlowNode = processModelFacade.getFlowNodeById('StartEvent_1');

    const boundaryEvents: Array<Model.Events.BoundaryEvent> = processModelFacade.getBoundaryEventsFor(flowNodeWithOutBoundaryEvents);
    should(boundaryEvents).be.instanceOf(Array);
    should(boundaryEvents.length).be.equal(0, 'The BoundaryEvent list should have been empty, because the FlowNode doesn\'t have any!');
  });

  it('should return an empty list, when the ID of a non-existing FlowNode is used.', async() => {

    const dummyData: any = {
      id: 'some non-existing flow node',
    };

    const boundaryEvents: Array<Model.Events.BoundaryEvent> = processModelFacade.getBoundaryEventsFor(dummyData);
    should(boundaryEvents).be.instanceOf(Array);
    should(boundaryEvents.length).be.equal(0, 'The BoundaryEvent list should have been empty, because the FlowNode doesn\'t have any!');
  });
});
