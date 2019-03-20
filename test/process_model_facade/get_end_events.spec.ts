import * as should from 'should';

import {Model} from '@process-engine/process_model.contracts';

import {ProcessModelFacade} from '../../src/runtime/facades/process_model_facade';
import {TestFixtureProvider} from '../test_fixture_provider';

// tslint:disable:no-magic-numbers
describe('ProcessModelFacade.getEndEvents', () => {

  let fixtureProvider: TestFixtureProvider;

  before(async() => {
    fixtureProvider = new TestFixtureProvider();
    await fixtureProvider.initialize();
  });

  it('should return all EndEvents of the given ProcessModel.', async() => {

    const processModelFilePath: string = './test/bpmns/process_with_boundary_events.bpmn';
    const parsedProcessModel: Model.Process = await fixtureProvider.parseProcessModelFromFile(processModelFilePath);
    const processModelFacade: ProcessModelFacade = fixtureProvider.createProcessModelFacade(parsedProcessModel);

    const endEvents: Array<Model.Events.EndEvent> = processModelFacade.getEndEvents();
    should(endEvents).be.instanceOf(Array);
    should(endEvents.length).be.equal(4);

    const expectedEndEventIds: Array<string> = [
      'EndEvent_TimeoutReached',
      'EndEvent_Regular',
      'EndEvent_SignalReceived',
      'EndEvent_MessageReceived',
    ];

    for (const expectedId of expectedEndEventIds) {
      const endEventExists: boolean = endEvents.some((endEvent: Model.Events.BoundaryEvent) => endEvent.id === expectedId);
      should(endEventExists).be.true(`The EndEventList should have contained an event with ID '${expectedId}', but none was found!`);
    }
  });

  it('should return all EndEvents of the given ProcessModel, if the EndEvents are spread across multiple lanes.', async() => {

    const processModelFilePath: string = './test/bpmns/sublane_test.bpmn';
    const parsedProcessModel: Model.Process = await fixtureProvider.parseProcessModelFromFile(processModelFilePath);
    const processModelFacade: ProcessModelFacade = fixtureProvider.createProcessModelFacade(parsedProcessModel);

    const endEvents: Array<Model.Events.EndEvent> = processModelFacade.getEndEvents();
    should(endEvents).be.instanceOf(Array);
    should(endEvents.length).be.equal(2);

    const expectedEndEventIds: Array<string> = [
      'EndEvent_1',
      'EndEvent_2',
    ];

    for (const expectedId of expectedEndEventIds) {
      const endEventExists: boolean = endEvents.some((endEvent: Model.Events.BoundaryEvent) => endEvent.id === expectedId);
      should(endEventExists).be.true(`The EndEventList should have contained an event with ID '${expectedId}', but none was found!`);
    }
  });
});
