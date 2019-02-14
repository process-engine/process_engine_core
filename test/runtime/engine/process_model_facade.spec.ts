import {before, describe, it} from 'mocha';
import * as should from 'should';

import {Model} from '@process-engine/process_engine_contracts';

import {ProcessModelFacadeTestFixture} from './process_model_facade_test_fixture';

describe('Process Model Facade', () => {

  describe('Parse DemoNutztierRiss.bpmn Diagram', () => {

    it('Should parse expected process', async() => {

      const fixture: ProcessModelFacadeTestFixture = new ProcessModelFacadeTestFixture();
      await fixture.initialize('./test/bpmns/DemoNutztierRiss.bpmn');

      await fixture.assertFlowNodes([
        'StartEvent_1',
        'VorgangErfassen',
        'Task_01xg9lr',
        'Task_00dom74',
        'notizSchreiben',
        'Task_1tk0lhq',
        'Task_1yzqmfq',
        'EndEvent_05uuvaq',
      ]);

      const vorgangAnlegen: Model.Activities.ServiceTask = fixture.getFlowNodeById<Model.Activities.ServiceTask>('Task_01xg9lr');
      const invocation: Model.Activities.MethodInvocation = vorgangAnlegen.invocation as Model.Activities.MethodInvocation;

      should(invocation.module).be.eql('HttpClient');
      should(invocation.method).be.eql('post');
      should(invocation.params).be.eql('[\'http://localhost:5000/api/vorgaenge/anlegen\', token.history.VorgangErfassen]');
    });
  });

  describe('Parse process_engine_io_release.bpmn Diagram', () => {

    it('Should parse expected process', async() => {

      const fixture: ProcessModelFacadeTestFixture = new ProcessModelFacadeTestFixture();
      await fixture.initialize('./test/bpmns/process_engine_io_release.bpmn');

      await fixture.assertFlowNodes([
        'ausserordentlicher_start',
        'ExclusiveSplitGateway_1',
        'ExclusiveJoinGateway_1',
        'ParallelSplitGateway_1',
        'Task_1tfjjzx',
        'Task_0a4b1bm',
        'Task_0bbikg1',
        'ParallelJoinGateway_1',
        'EndEvent_0eie6q6',
      ]);
    });
  });
});
