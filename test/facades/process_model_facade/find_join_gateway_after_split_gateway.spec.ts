import * as should from 'should';

import {Model} from '@process-engine/persistence_api.contracts';

import {ProcessModelFacade} from '../../../src/runtime/facades/process_model_facade';
import {TestFixtureProvider} from '../../test_fixture_provider';

describe('ProcessModelFacade.findJoinGatewayAfterSplitGateway', (): void => {

  let fixtureProvider: TestFixtureProvider;
  let processModelFacade: ProcessModelFacade;

  before(async (): Promise<void> => {
    fixtureProvider = new TestFixtureProvider();
    await fixtureProvider.initialize();

    const processModelFilePath = 'join_gateway_discovery_test.bpmn';
    const parsedProcessModel = await fixtureProvider.parseProcessModelFromFile(processModelFilePath);
    processModelFacade = fixtureProvider.createProcessModelFacade(parsedProcessModel);
  });

  it('Should return the Join Gateway that corresponds to the given Split Gateway.', async (): Promise<void> => {
    const splitGateway = <Model.Gateways.ParallelGateway> processModelFacade.getFlowNodeById('Parallel_Split_Gateway_1');
    const joinGateway = processModelFacade.findJoinGatewayAfterSplitGateway(splitGateway);

    should.exist(joinGateway);
    should(joinGateway.id).be.equal('Parallel_Join_Gateway_1');
  });

  it('Should return the matching Join Gateway, after travelling through a nested Gateway of the same type.', async (): Promise<void> => {
    const splitGateway = <Model.Gateways.ParallelGateway> processModelFacade.getFlowNodeById('Parallel_Split_Gateway_2');
    const joinGateway = processModelFacade.findJoinGatewayAfterSplitGateway(splitGateway);

    should.exist(joinGateway);
    should(joinGateway.id).be.equal('Parallel_Join_Gateway_2');
  });

  it('Should return the matching Join Gateway, after travelling through a nested Gateway of a different type.', async (): Promise<void> => {
    const splitGateway = <Model.Gateways.ParallelGateway> processModelFacade.getFlowNodeById('Parallel_Split_Gateway_3');
    const joinGateway = processModelFacade.findJoinGatewayAfterSplitGateway(splitGateway);

    should.exist(joinGateway);
    should(joinGateway.id).be.equal('Parallel_Join_Gateway_3');
  });

  it('Should return the matching Join Gateway, if one of the branches of the split gateway leads to an EndEvent.', async (): Promise<void> => {
    const splitGateway = <Model.Gateways.ParallelGateway> processModelFacade.getFlowNodeById('Parallel_Split_Gateway_4');
    const joinGateway = processModelFacade.findJoinGatewayAfterSplitGateway(splitGateway);

    should.exist(joinGateway);
    should(joinGateway.id).be.equal('Parallel_Join_Gateway_4');
  });

  it('Should return the matching Join Gateway, if one of the branches of a nested split gateway leads to an EndEvent.', async (): Promise<void> => {
    const splitGateway = <Model.Gateways.ParallelGateway> processModelFacade.getFlowNodeById('Parallel_Split_Gateway_5');
    const joinGateway = processModelFacade.findJoinGatewayAfterSplitGateway(splitGateway);

    should.exist(joinGateway);
    should(joinGateway.id).be.equal('Parallel_Join_Gateway_5');
  });

  it('Should not travel through a path that starts at a BoundaryEvent.', async (): Promise<void> => {
    const splitGateway = <Model.Gateways.ParallelGateway> processModelFacade.getFlowNodeById('Parallel_Split_Gateway_6');
    const joinGateway = processModelFacade.findJoinGatewayAfterSplitGateway(splitGateway);

    should.exist(joinGateway);
    should(joinGateway.id).be.equal('Parallel_Join_Gateway_6');
  });

  it('Should pass through a Join Gateway on the same level that is of a different type.', async (): Promise<void> => {
    const splitGateway = <Model.Gateways.ParallelGateway> processModelFacade.getFlowNodeById('Parallel_Split_Gateway_7');
    const joinGateway = processModelFacade.findJoinGatewayAfterSplitGateway(splitGateway);

    should.exist(joinGateway);
    should(joinGateway.id).be.equal('Parallel_Join_Gateway_7');
  });

  it('Should return undefined, if none of the branches after the split gateway lead to a corresponding join gateway.', async (): Promise<void> => {
    const splitGateway = <Model.Gateways.ParallelGateway> processModelFacade.getFlowNodeById('Exclusive_Split_Gateway_1');
    const joinGateway = processModelFacade.findJoinGatewayAfterSplitGateway(splitGateway);

    should.not.exist(joinGateway);
  });

  // eslint-disable-next-line
  it('Should throw an error, if the branches lead to different join gateways of the same type, which constitutes an invalid BPMN.', async (): Promise<void> => {
    const splitGateway = <Model.Gateways.ParallelGateway> processModelFacade.getFlowNodeById('Parallel_Split_Gateway_8');

    try {
      const joinGateway = processModelFacade.findJoinGatewayAfterSplitGateway(splitGateway);

      should.fail(joinGateway, undefined, 'This should have caused an error!');
    } catch (error) {
      should(error.message).match(/failed to discover definitive join gateway/i);
      should(error.code).be.equal(500);

      should(error).have.property('additionalInformation');
      should(error.additionalInformation.splitGateway).be.eql(splitGateway);
      should(error.additionalInformation.parentSplitGateway).be.undefined();

      should(error.additionalInformation.discoveredJoinGateways).be.an.Array();
      should(error.additionalInformation.discoveredJoinGateways).have.a.lengthOf(2);
    }
  });
});
