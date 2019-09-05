import * as should from 'should';

import {SubProcessModelFacade} from '../../../src/runtime/facades/sub_process_model_facade';
import {TestFixtureProvider} from '../../test_fixture_provider';

describe('SubProcessModelFacade.getEndEvents', (): void => {

  let fixtureProvider: TestFixtureProvider;
  let subProcessModelFacade: SubProcessModelFacade;

  before(async (): Promise<void> => {
    fixtureProvider = new TestFixtureProvider();
    await fixtureProvider.initialize();

    subProcessModelFacade = await fixtureProvider.createSubProcessModelFacade();
  });

  it('Should return all EndEvents of the given ProcessModel.', async (): Promise<void> => {

    const endEvents = subProcessModelFacade.getEndEvents();
    should(endEvents).be.instanceOf(Array);
    should(endEvents.length).be.equal(3);

    const expectedEndEventIds = [
      'EndEvent_Subprocess',
      'EndEvent_2',
      'EndEvent_3',
    ];

    for (const expectedId of expectedEndEventIds) {
      const endEventExists = endEvents.some((endEvent): boolean => endEvent.id === expectedId);
      should(endEventExists).be.true(`The EndEventList should have contained an event with ID '${expectedId}', but none was found!`);
    }
  });

  it('Should not be able to return any of the EndEvents that lie outside of the Subprocess.', async (): Promise<void> => {

    const externalEndEventId = 'EndEvent_1';
    const endEvents = subProcessModelFacade.getEndEvents();

    should(endEvents).not.containEql(externalEndEventId);
  });
});
