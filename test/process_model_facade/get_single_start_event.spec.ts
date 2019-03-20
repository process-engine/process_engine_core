import * as should from 'should';

import {Model} from '@process-engine/process_model.contracts';

import {ProcessModelFacade} from '../../src/runtime/facades/process_model_facade';
import {TestFixtureProvider} from '../test_fixture_provider';

describe('ProcessModelFacade.getSingleStartEvent', () => {

  let fixtureProvider: TestFixtureProvider;

  before(async() => {
    fixtureProvider = new TestFixtureProvider();
    await fixtureProvider.initialize();
  });

  it('should return the single StartEvent for a ProcessModel that only has one.', async() => {

    const processModelFilePath: string = './test/bpmns/generic_sample.bpmn';
    const parsedProcessModel: Model.Process = await fixtureProvider.parseProcessModelFromFile(processModelFilePath);
    const processModelFacade: ProcessModelFacade = fixtureProvider.createProcessModelFacade(parsedProcessModel);

    const expectedStartEventId: string = 'ProcessInputEvent';

    const startEvent: Model.Events.StartEvent = processModelFacade.getSingleStartEvent();

    should(startEvent).be.instanceOf(Model.Events.StartEvent);
    should(startEvent.id).be.equal(expectedStartEventId);
  });

  it('should pick the first StartEvent from a ProcessModel with multiple StartEvents.', async() => {

    const processModelFilePath: string = './test/bpmns/intermediate_event_link_test.bpmn';
    const parsedProcessModel: Model.Process = await fixtureProvider.parseProcessModelFromFile(processModelFilePath);
    const processModelFacade: ProcessModelFacade = fixtureProvider.createProcessModelFacade(parsedProcessModel);

    const expectedStartEventId: string = 'StartEvent_1';

    const startEvent: Model.Events.StartEvent = processModelFacade.getSingleStartEvent();

    should(startEvent).be.instanceOf(Model.Events.StartEvent);
    should(startEvent.id).be.equal(expectedStartEventId);
  });
});
