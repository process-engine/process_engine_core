import * as should from 'should';

import {TestFixtureProvider} from '../../test_fixture_provider';

describe('SubProcessModelFacade.getUserTasks', (): void => {

  let fixtureProvider: TestFixtureProvider;

  before(async (): Promise<void> => {
    fixtureProvider = new TestFixtureProvider();
    await fixtureProvider.initialize();
  });

  it('Should return one UserTask for a ProcessModel that only has one.', async (): Promise<void> => {

    const subProcessModelFacade = await fixtureProvider.createSubProcessModelFacade('subprocess_2_test.bpmn');

    const expectedUserTaskId = 'UserTask_1';

    const userTasks = subProcessModelFacade.getUserTasks();

    should(userTasks).be.instanceOf(Array);
    should(userTasks.length).be.equal(1);
    should(userTasks[0].id).be.equal(expectedUserTaskId);
  });

  it('Should return all UserTasks from a ProcessModel with multiple UserTasks.', async (): Promise<void> => {

    const subProcessModelFacade = await fixtureProvider.createSubProcessModelFacade();

    const expectedUserTaskIds = [
      'UserTask_1',
      'UserTask_2',
      'UserTask_Invalid',
    ];

    const userTasks = subProcessModelFacade.getUserTasks();

    should(userTasks).be.instanceOf(Array);
    should(userTasks.length).be.equal(3);

    for (const userTask of userTasks) {
      should(expectedUserTaskIds).containEql(userTask.id);
    }
  });

  it('Should not include UserTasks from outside the Subprocess.', async (): Promise<void> => {

    const subProcessModelFacade = await fixtureProvider.createSubProcessModelFacade('subprocess_2_test.bpmn');

    const expectedUserTaskId = 'ExternalUserTask';

    const userTasks = subProcessModelFacade.getUserTasks();

    should(userTasks).be.instanceOf(Array);
    should(userTasks).not.containEql(expectedUserTaskId);
  });

  it('Should return an empty Array for a ProcessModel that has no UserTasks.', async (): Promise<void> => {

    const subProcessModelFacade = await fixtureProvider.createSubProcessModelFacade('subprocess_links_test.bpmn');

    const userTasks = subProcessModelFacade.getUserTasks();

    should(userTasks).be.instanceOf(Array);
    should(userTasks.length).be.equal(0);
  });
});
