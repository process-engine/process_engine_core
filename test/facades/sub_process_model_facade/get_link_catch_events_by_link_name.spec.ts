import * as should from 'should';

import {SubProcessModelFacade} from '../../../src/runtime/facades/sub_process_model_facade';
import {TestFixtureProvider} from '../../test_fixture_provider';

describe('SubProcessModelFacade.getLinkCatchEventsByLinkName', (): void => {

  let fixtureProvider: TestFixtureProvider;

  let subProcessModelFacade: SubProcessModelFacade;

  before(async (): Promise<void> => {
    fixtureProvider = new TestFixtureProvider();
    await fixtureProvider.initialize();

    subProcessModelFacade = await fixtureProvider.createSubProcessModelFacade('subprocess_links_test.bpmn');
  });

  it('Should correctly return a single matching LinkCatchEvent for InternalLink.', async (): Promise<void> => {

    const linkNameToFind = 'InternalLink';

    const linkEvents = subProcessModelFacade.getLinkCatchEventsByLinkName(linkNameToFind);

    should(linkEvents).be.instanceOf(Array);
    should(linkEvents.length).be.equal(1);
    should(linkEvents[0].linkEventDefinition.name).be.equal(linkNameToFind);
  });

  it('Should return multiple matching LinkCatchEvent for InternalLink2.', async (): Promise<void> => {

    const linkNameToFind = 'InternalLink2';

    const linkEvents = subProcessModelFacade.getLinkCatchEventsByLinkName(linkNameToFind);

    should(linkEvents).be.instanceOf(Array);
    should(linkEvents.length).be.equal(2);
    for (const linkEvent of linkEvents) {
      should(linkEvent.linkEventDefinition.name).be.equal(linkNameToFind);
    }
  });

  it('Should return an empty Array for a link without any matching CatchEvents.', async (): Promise<void> => {

    const linkNameToFind = 'testlink3';

    const linkEvents = subProcessModelFacade.getLinkCatchEventsByLinkName(linkNameToFind);

    should(linkEvents).be.instanceOf(Array);
    should(linkEvents.length).be.equal(0);
  });

  it('Should return an empty Array, if a matching CatchEvent exists only outside of the Subprocess.', async (): Promise<void> => {

    const linkNameToFind = 'ExternalLink';

    const linkEvents = subProcessModelFacade.getLinkCatchEventsByLinkName(linkNameToFind);

    should(linkEvents).be.instanceOf(Array);
    should(linkEvents.length).be.equal(0);
  });
});
