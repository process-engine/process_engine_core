import * as should from 'should';

import {ProcessModelFacade} from '../../../src/runtime/facades/process_model_facade';
import {TestFixtureProvider} from '../../test_fixture_provider';

describe('ProcessModelFacade.getLinkCatchEventsByLinkName', (): void => {

  let fixtureProvider: TestFixtureProvider;

  let processModelFacade: ProcessModelFacade;

  before(async (): Promise<void> => {
    fixtureProvider = new TestFixtureProvider();
    await fixtureProvider.initialize();

    const processModelFilePath = 'intermediate_event_link_test.bpmn';
    const parsedProcessModel = await fixtureProvider.parseProcessModelFromFile(processModelFilePath);

    processModelFacade = fixtureProvider.createProcessModelFacade(parsedProcessModel);
  });

  it('Should correctly return a single matching LinkCatchEvent for testlink1.', async (): Promise<void> => {

    const linkNameToFind = 'testlink1';

    const linkEvents = processModelFacade.getLinkCatchEventsByLinkName(linkNameToFind);

    should(linkEvents).be.instanceOf(Array);
    should(linkEvents.length).be.equal(1);
    should(linkEvents[0].linkEventDefinition.name).be.equal(linkNameToFind);
  });

  it('Should return multiple matching LinkCatchEvent for testlink2.', async (): Promise<void> => {

    const linkNameToFind = 'testlink2';

    const linkEvents = processModelFacade.getLinkCatchEventsByLinkName(linkNameToFind);

    should(linkEvents).be.instanceOf(Array);
    should(linkEvents.length).be.equal(2);
    for (const linkEvent of linkEvents) {
      should(linkEvent.linkEventDefinition.name).be.equal(linkNameToFind);
    }
  });

  it('Should return an empty Array for testlink3.', async (): Promise<void> => {

    const linkNameToFind = 'testlink3';

    const linkEvents = processModelFacade.getLinkCatchEventsByLinkName(linkNameToFind);

    should(linkEvents).be.instanceOf(Array);
    should(linkEvents.length).be.equal(0);
  });
});
