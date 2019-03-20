import * as should from 'should';

import {Model} from '@process-engine/process_model.contracts';

import {ProcessModelFacade} from '../../src/runtime/facades/process_model_facade';
import {TestFixtureProvider} from '../test_fixture_provider';

describe('ProcessModelFacade.getLaneForFlowNode', () => {

  let fixtureProvider: TestFixtureProvider;

  before(async() => {
    fixtureProvider = new TestFixtureProvider();
    await fixtureProvider.initialize();
  });

  it('should successfully get the lane for each FlowNode of the DemoNutztierRiss Diagram, which contains multiple parallel lanes', async() => {

    const processModelFilePath: string = './test/bpmns/DemoNutztierRiss.bpmn';
    const parsedProcessModel: Model.Process = await fixtureProvider.parseProcessModelFromFile(processModelFilePath);

    const processModelFacade: ProcessModelFacade = fixtureProvider.createProcessModelFacade(parsedProcessModel);

    // tslint:disable-next-line:typedef
    const expectedLanes = {
      StartEvent_1: 'VWK',
      VorgangErfassen: 'VWK',
      Task_01xg9lr: 'VWK',
      Task_00dom74: 'VET',
      notizSchreiben: 'VET',
      Task_1tk0lhq: 'ABL',
      Task_1yzqmfq: 'ABL',
      EndEvent_05uuvaq: 'ABL',
    };

    for (const flowNode of parsedProcessModel.flowNodes) {
      const lane: Model.ProcessElements.Lane = processModelFacade.getLaneForFlowNode(flowNode.id);

      const expectedLaneName: string = expectedLanes[flowNode.id];

      const assertionErrorMessage: string = `Expected lane for FlowNodeId '${flowNode.id}' to be '${expectedLaneName}', but received '${lane.name}'`;
      should(expectedLaneName).be.equal(lane.name, assertionErrorMessage);
    }
  });

  it('should successfully return undefined for each FlowNode of the generic_sample Diagram, which contains no lanes', async() => {

    const processModelFilePath: string = './test/bpmns/generic_sample.bpmn';
    const parsedProcessModel: Model.Process = await fixtureProvider.parseProcessModelFromFile(processModelFilePath);

    const processModelFacade: ProcessModelFacade = fixtureProvider.createProcessModelFacade(parsedProcessModel);

    for (const flowNode of parsedProcessModel.flowNodes) {
      const lane: Model.ProcessElements.Lane = processModelFacade.getLaneForFlowNode(flowNode.id);

      should(lane).be.undefined();
    }
  });

  it('should successfully get the lane for each FlowNode of the sublane_test Diagram, which contains multiple sublanes', async() => {

    const processModelFilePath: string = './test/bpmns/sublane_test.bpmn';
    const parsedProcessModel: Model.Process = await fixtureProvider.parseProcessModelFromFile(processModelFilePath);

    const processModelFacade: ProcessModelFacade = fixtureProvider.createProcessModelFacade(parsedProcessModel);

    // tslint:disable-next-line:typedef
    const expectedLanes = {
      StartEvent_1: 'LaneC',
      ExclusiveGateway_1ax0imj: 'LaneC',
      Task_0ukwbko: 'LaneC',
      Task_0e8cbxl: 'LaneB',
      EndEvent_1: 'LaneC',
      EndEvent_2: 'LaneB',
    };

    for (const flowNode of parsedProcessModel.flowNodes) {
      const lane: Model.ProcessElements.Lane = processModelFacade.getLaneForFlowNode(flowNode.id);

      const expectedLaneName: string = expectedLanes[flowNode.id];

      const assertionErrorMessage: string = `Expected lane for FlowNodeId '${flowNode.id}' to be '${expectedLaneName}', but received '${lane.name}'`;
      should(expectedLaneName).be.equal(lane.name, assertionErrorMessage);
    }
  });
});
