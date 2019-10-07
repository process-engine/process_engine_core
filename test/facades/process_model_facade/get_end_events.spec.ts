import * as should from 'should';

import {Model} from '@process-engine/persistence_api.contracts';

import {TestFixtureProvider} from '../../test_fixture_provider';

describe('ProcessModelFacade.getEndEvents', (): void => {

  let fixtureProvider: TestFixtureProvider;

  before(async (): Promise<void> => {
    fixtureProvider = new TestFixtureProvider();
    await fixtureProvider.initialize();
  });

  it('Should return all EndEvents of the given ProcessModel.', async (): Promise<void> => {

    const processModelFilePath = 'process_with_boundary_events.bpmn';
    const parsedProcessModel = await fixtureProvider.parseProcessModelFromFile(processModelFilePath);
    const processModelFacade = fixtureProvider.createProcessModelFacade(parsedProcessModel);

    const endEvents = processModelFacade.getEndEvents();
    should(endEvents).be.instanceOf(Array);
    should(endEvents.length).be.equal(4);

    const expectedEndEventIds = [
      'EndEvent_TimeoutReached',
      'EndEvent_Regular',
      'EndEvent_SignalReceived',
      'EndEvent_MessageReceived',
    ];

    for (const expectedId of expectedEndEventIds) {
      const endEventExists = endEvents.some((endEvent: Model.Events.BoundaryEvent): boolean => endEvent.id === expectedId);
      should(endEventExists).be.true(`The EndEventList should have contained an event with ID '${expectedId}', but none was found!`);
    }
  });

  it('Should return all EndEvents of the given ProcessModel, if the EndEvents are spread across multiple lanes.', async (): Promise<void> => {

    const processModelFilePath = 'sublane_test.bpmn';
    const parsedProcessModel = await fixtureProvider.parseProcessModelFromFile(processModelFilePath);
    const processModelFacade = fixtureProvider.createProcessModelFacade(parsedProcessModel);

    const endEvents = processModelFacade.getEndEvents();
    should(endEvents).be.instanceOf(Array);
    should(endEvents.length).be.equal(2);

    const expectedEndEventIds = [
      'EndEvent_1',
      'EndEvent_2',
    ];

    for (const expectedId of expectedEndEventIds) {
      const endEventExists = endEvents.some((endEvent: Model.Events.BoundaryEvent): boolean => endEvent.id === expectedId);
      should(endEventExists).be.true(`The EndEventList should have contained an event with ID '${expectedId}', but none was found!`);
    }
  });
});
