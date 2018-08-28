const should = require('should');

import { describe, it, before } from "mocha";
import { Model } from '@process-engine/process_engine_contracts';
import { ProcessModelFacadeTestFixture } from "./process_model_facade_test_fixture";

describe("ProcessModelFacade", () => {

    let fixture: ProcessModelFacadeTestFixture;

    before(async () => {
        fixture = new ProcessModelFacadeTestFixture();
    });

    describe("parse DemoNutztierRiss.bpmn", () => {
        it("Should parse expected process", async () => {

            const processModelFacade = await fixture.createTestObject('./test/bpmns/DemoNutztierRiss.bpmn');

            await fixture.assertFlowNodes([
                'StartEvent_1',
                'VorgangErfassen',
                'Task_01xg9lr',
                'Task_00dom74',
                'notizSchreiben',
                'Task_1tk0lhq',
                'Task_1yzqmfq',
                'EndEvent_05uuvaq'
            ], processModelFacade);

            const vorgangAnlegen = fixture.getFlowNodeById<Model.Activities.ServiceTask>('Task_01xg9lr', processModelFacade);
            const invocation: Model.Activities.MethodInvocation = vorgangAnlegen.invocation as Model.Activities.MethodInvocation;
            should(invocation.module).be.eql('HttpService');
            should(invocation.method).be.eql('post');
            should(invocation.params).be.eql('[\'http://localhost:5000/api/vorgaenge/anlegen\', token.history.VorgangErfassen]');
        });
    })
});
