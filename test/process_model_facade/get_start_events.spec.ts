import * as should from 'should';

import {Model} from '@process-engine/process_model.contracts';

import {ProcessModelFacade} from '../../src/runtime/facades/process_model_facade';
import {TestFixtureProvider} from '../test_fixture_provider';

describe('ProcessModelFacade.getStartEvents', () => {

  let fixtureProvider: TestFixtureProvider;

  before(async() => {
    fixtureProvider = new TestFixtureProvider();
    await fixtureProvider.initialize();
  });

  it('should return one StartEvent for a ProcessModel that only has one.', async() => {

    const processModelFilePath: string = './test/bpmns/generic_sample.bpmn';
    const parsedProcessModel: Model.Process = await fixtureProvider.parseProcessModelFromFile(processModelFilePath);
    const processModelFacade: ProcessModelFacade = fixtureProvider.createProcessModelFacade(parsedProcessModel);

    const expectedStartEventId: string = 'ProcessInputEvent';

    const startEvents: Array<Model.Events.StartEvent> = processModelFacade.getStartEvents();

    should(startEvents).be.instanceOf(Array);
    should(startEvents.length).be.equal(1);
    should(startEvents[0].id).be.equal(expectedStartEventId);
  });

  it('should return all StartEvents from a ProcessModel with multiple StartEvents.', async() => {

    const processModelFilePath: string = './test/bpmns/intermediate_event_link_test.bpmn';
    const parsedProcessModel: Model.Process = await fixtureProvider.parseProcessModelFromFile(processModelFilePath);
    const processModelFacade: ProcessModelFacade = fixtureProvider.createProcessModelFacade(parsedProcessModel);

    const expectedStartEventIds: Array<string> = [
      'StartEvent_1',
      'StartEvent_2',
      'StartEvent_666',
    ];

    const startEvents: Array<Model.Events.StartEvent> = processModelFacade.getStartEvents();

    should(startEvents).be.instanceOf(Array);
    // tslint:disable-next-line:no-magic-numbers
    should(startEvents.length).be.equal(3);

    for (const startEvent of startEvents) {
      should(expectedStartEventIds).containEql(startEvent.id);
    }
  });
});
