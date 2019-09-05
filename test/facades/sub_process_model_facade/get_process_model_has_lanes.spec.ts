import * as should from 'should';

import {TestFixtureProvider} from '../../test_fixture_provider';

describe('SubProcessModelFacade.getProcessModelHasLanes', (): void => {

  let fixtureProvider: TestFixtureProvider;

  before(async (): Promise<void> => {
    fixtureProvider = new TestFixtureProvider();
    await fixtureProvider.initialize();
  });

  it('Should throw an error, since Subprocesses cannot have lanes.', async (): Promise<void> => {

    const subProcessModelFacade = await fixtureProvider.createSubProcessModelFacade();

    try {
      const processModelHasLanes = subProcessModelFacade.getProcessModelHasLanes();
      should.fail(processModelHasLanes, undefined, 'This should not have worked, because Subprocesses cannot have lanes!');
    } catch (error) {
      should(error.message).be.match(/subprocesses cannot have lanes/i);
    }
  });
});
