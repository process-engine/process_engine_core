/* eslint-disable @typescript-eslint/camelcase */
import * as should from 'should';

import {TestFixtureProvider} from '../../test_fixture_provider';

describe('ProcessModelFacade.getLaneForFlowNode', (): void => {

  let fixtureProvider: TestFixtureProvider;

  before(async (): Promise<void> => {
    fixtureProvider = new TestFixtureProvider();
    await fixtureProvider.initialize();
  });

  // eslint-disable-next-line max-len
  it('Should successfully get the lane for each FlowNode of the DemoNutztierRiss Diagram, which contains multiple parallel lanes', async (): Promise<void> => {

    const processModelFilePath = 'DemoNutztierRiss.bpmn';
    const parsedProcessModel = await fixtureProvider.parseProcessModelFromFile(processModelFilePath);

    const processModelFacade = fixtureProvider.createProcessModelFacade(parsedProcessModel);

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
      const lane = processModelFacade.getLaneForFlowNode(flowNode.id);

      const expectedLaneName = expectedLanes[flowNode.id];

      const assertionErrorMessage = `Expected lane for FlowNodeId '${flowNode.id}' to be '${expectedLaneName}', but received '${lane.name}'`;
      should(expectedLaneName).be.equal(lane.name, assertionErrorMessage);
    }
  });

  it('Should successfully return undefined for each FlowNode of the generic_sample Diagram, which contains no lanes', async (): Promise<void> => {

    const processModelFilePath = 'generic_sample.bpmn';
    const parsedProcessModel = await fixtureProvider.parseProcessModelFromFile(processModelFilePath);

    const processModelFacade = fixtureProvider.createProcessModelFacade(parsedProcessModel);

    for (const flowNode of parsedProcessModel.flowNodes) {
      const lane = processModelFacade.getLaneForFlowNode(flowNode.id);

      should(lane).be.undefined();
    }
  });

  it('Should successfully get the lane for each FlowNode of the sublane_test Diagram, which contains multiple sublanes', async (): Promise<void> => {

    const processModelFilePath = 'sublane_test.bpmn';
    const parsedProcessModel = await fixtureProvider.parseProcessModelFromFile(processModelFilePath);

    const processModelFacade = fixtureProvider.createProcessModelFacade(parsedProcessModel);

    const expectedLanes = {
      StartEvent_1: 'LaneC',
      ExclusiveGateway_1ax0imj: 'LaneC',
      Task_0ukwbko: 'LaneC',
      Task_0e8cbxl: 'LaneB',
      EndEvent_1: 'LaneC',
      EndEvent_2: 'LaneB',
    };

    for (const flowNode of parsedProcessModel.flowNodes) {
      const lane = processModelFacade.getLaneForFlowNode(flowNode.id);

      const expectedLaneName = expectedLanes[flowNode.id];

      const assertionErrorMessage = `Expected lane for FlowNodeId '${flowNode.id}' to be '${expectedLaneName}', but received '${lane.name}'`;
      should(expectedLaneName).be.equal(lane.name, assertionErrorMessage);
    }
  });
});
