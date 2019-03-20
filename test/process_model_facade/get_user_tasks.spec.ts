import * as should from 'should';

import {Model} from '@process-engine/process_model.contracts';

import {ProcessModelFacade} from '../../src/runtime/facades/process_model_facade';
import {TestFixtureProvider} from '../test_fixture_provider';

describe('ProcessModelFacade.getUserTasks', () => {

  let fixtureProvider: TestFixtureProvider;

  before(async() => {
    fixtureProvider = new TestFixtureProvider();
    await fixtureProvider.initialize();
  });

  it('should return one UserTask for a ProcessModel that only has one.', async() => {

    const processModelFilePath: string = './test/bpmns/user_task_test.bpmn';
    const parsedProcessModel: Model.Process = await fixtureProvider.parseProcessModelFromFile(processModelFilePath);
    const processModelFacade: ProcessModelFacade = fixtureProvider.createProcessModelFacade(parsedProcessModel);

    const expectedUserTaskId: string = 'user_task_1';

    const userTasks: Array<Model.Activities.UserTask> = processModelFacade.getUserTasks();

    should(userTasks).be.instanceOf(Array);
    should(userTasks.length).be.equal(1);
    should(userTasks[0].id).be.equal(expectedUserTaskId);
  });

  it('should return all UserTasks from a ProcessModel with multiple UserTasks.', async() => {

    const processModelFilePath: string = './test/bpmns/user_task_multiple.bpmn';
    const parsedProcessModel: Model.Process = await fixtureProvider.parseProcessModelFromFile(processModelFilePath);
    const processModelFacade: ProcessModelFacade = fixtureProvider.createProcessModelFacade(parsedProcessModel);

    const expectedUserTaskIds: Array<string> = [
      'Task_004be4s',
      'Task_1xcmvjs',
    ];

    const userTasks: Array<Model.Activities.UserTask> = processModelFacade.getUserTasks();

    should(userTasks).be.instanceOf(Array);
    // tslint:disable-next-line:no-magic-numbers
    should(userTasks.length).be.equal(2);

    for (const userTask of userTasks) {
      should(expectedUserTaskIds).containEql(userTask.id);
    }
  });

  it('should return an empty Array for a ProcessModel that has no UserTasks.', async() => {

    const processModelFilePath: string = './test/bpmns/generic_sample.bpmn';
    const parsedProcessModel: Model.Process = await fixtureProvider.parseProcessModelFromFile(processModelFilePath);
    const processModelFacade: ProcessModelFacade = fixtureProvider.createProcessModelFacade(parsedProcessModel);

    const userTasks: Array<Model.Activities.UserTask> = processModelFacade.getUserTasks();

    should(userTasks).be.instanceOf(Array);
    should(userTasks.length).be.equal(0);
  });
});
