import * as should from 'should';

import {Model} from '@process-engine/process_model.contracts';

import {ProcessModelFacade} from '../../src/runtime/facades/process_model_facade';
import {TestFixtureProvider} from '../test_fixture_provider';

describe('ProcessModelFacade.getLinkCatchEventsByLinkName', () => {

  let fixtureProvider: TestFixtureProvider;

  let processModelFacade: ProcessModelFacade;

  before(async() => {
    fixtureProvider = new TestFixtureProvider();
    await fixtureProvider.initialize();

    const processModelFilePath: string = './test/bpmns/intermediate_event_link_test.bpmn';
    const parsedProcessModel: Model.Process = await fixtureProvider.parseProcessModelFromFile(processModelFilePath);

    processModelFacade = fixtureProvider.createProcessModelFacade(parsedProcessModel);
  });

  it('should correctly return a single matching LinkCatchEvent for testlink1.', async() => {

    const linkNameToFind: string = 'testlink1';

    const linkEvents: Array<Model.Events.IntermediateCatchEvent> = processModelFacade.getLinkCatchEventsByLinkName(linkNameToFind);

    should(linkEvents).be.instanceOf(Array);
    should(linkEvents.length).be.equal(1);
    should(linkEvents[0].linkEventDefinition.name).be.equal(linkNameToFind);
  });

  it('should return multiple matching LinkCatchEvent for testlink2.', async() => {

    const linkNameToFind: string = 'testlink2';

    const linkEvents: Array<Model.Events.IntermediateCatchEvent> = processModelFacade.getLinkCatchEventsByLinkName(linkNameToFind);

    should(linkEvents).be.instanceOf(Array);
    // tslint:disable-next-line:no-magic-numbers
    should(linkEvents.length).be.equal(2);
    for (const linkEvent of linkEvents) {
      should(linkEvent.linkEventDefinition.name).be.equal(linkNameToFind);
    }
  });

  it('should return an empty Array for testlink3.', async() => {

    const linkNameToFind: string = 'testlink3';

    const linkEvents: Array<Model.Events.IntermediateCatchEvent> = processModelFacade.getLinkCatchEventsByLinkName(linkNameToFind);

    should(linkEvents).be.instanceOf(Array);
    should(linkEvents.length).be.equal(0);
  });
});
