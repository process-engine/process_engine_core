import * as clone from 'clone';
import * as should from 'should';

import {IFlowNodeInstanceResult, ProcessEndedMessage} from '@process-engine/process_engine_contracts';

import {IProcessInstanceConfig} from '../../../src/runtime/facades/iprocess_instance_config';
import {ProcessInstanceStateHandlingFacade} from '../../../src/runtime/facades/process_instance_state_handling_facade';
import {EventAggregatorMock} from '../../mocks';
import {TestFixtureProvider} from '../../test_fixture_provider';

describe('ProcessInstanceStateHandlingFacade.sendProcessInstanceFinishedNotification', (): void => {

  let fixtureProvider: TestFixtureProvider;

  const sampleIdentity = {
    userId: 'userId',
    token: 'dsöfhpadfsghösjbgsöjghbdlögdfg',
  };

  let sampleProcessInstanceConfig: IProcessInstanceConfig;

  const sampleResultToken: IFlowNodeInstanceResult = {
    flowNodeInstanceId: 'string',
    flowNodeId: 'string',
    result: {some: 'value'},
  };

  before(async (): Promise<void> => {
    fixtureProvider = new TestFixtureProvider();
    await fixtureProvider.initialize();

    sampleProcessInstanceConfig = {
      correlationId: 'correlationId',
      processModelId: 'processModelId',
      processInstanceId: 'processInstanceId',
      parentProcessInstanceId: 'parentProcessInstanceId',
      processModelFacade: fixtureProvider.createProcessModelFacade({id: 'someId'} as any),
      startEvent: {id: 'startevent'} as any,
      startEventInstance: {id: 'flowNodeInstanceId'} as any,
      processToken: {payload: {some: 'value'}} as any,
      processTokenFacade: fixtureProvider.createProcessTokenFacade(),
    };
  });

  describe('Execution', (): void => {

    it('Should publish the correct event on the event aggregator', async (): Promise<void> => {

      return new Promise(async (resolve): Promise<void> => {

        const callback = (eventName: string, payload: ProcessEndedMessage): void => {
          const expectedEventName = `/processengine/process/${sampleProcessInstanceConfig.processInstanceId}/ended`;

          should(eventName).be.eql(expectedEventName);
          should(payload.correlationId).be.eql(sampleProcessInstanceConfig.correlationId);
          should(payload.currentToken).be.eql(sampleResultToken.result);
          should(payload.flowNodeId).be.eql(sampleResultToken.flowNodeId);
          should(payload.flowNodeInstanceId).be.eql(sampleResultToken.flowNodeInstanceId);
          should(payload.processInstanceId).be.eql(sampleProcessInstanceConfig.processInstanceId);
          should(payload.processInstanceOwner).be.eql(sampleIdentity);
          should(payload.processModelId).be.eql(sampleProcessInstanceConfig.processModelId);
          resolve();
        };

        const eventAggregatorMock = new EventAggregatorMock();
        eventAggregatorMock.publish = callback;

        const processInstanceStateHandlingFacade = fixtureProvider.createProcessInstanceStateHandlingFacade(undefined, eventAggregatorMock);

        await processInstanceStateHandlingFacade
          .sendProcessInstanceFinishedNotification(sampleIdentity, sampleProcessInstanceConfig, sampleResultToken);
      });
    });

  });

  describe('Sanity Checks', (): void => {

    let processInstanceStateHandlingFacade: ProcessInstanceStateHandlingFacade;

    before((): void => {
      processInstanceStateHandlingFacade = fixtureProvider.createProcessInstanceStateHandlingFacade();
    });

    it('Should throw an error, if no ProcessInstanceConfig is provided', async (): Promise<void> => {
      try {
        await processInstanceStateHandlingFacade.sendProcessInstanceFinishedNotification(sampleIdentity, undefined, sampleResultToken);
        should.fail('received result', undefined, 'Expected this test to cause an error!');
      } catch (error) {
        should(error).be.instanceOf(Error);
      }
    });

    it('Should throw an error, if no result is given', async (): Promise<void> => {
      try {
        await processInstanceStateHandlingFacade.sendProcessInstanceFinishedNotification(sampleIdentity, sampleProcessInstanceConfig, undefined);
        should.fail('received result', undefined, 'Expected this test to cause an error!');
      } catch (error) {
        should(error).be.instanceOf(Error);
      }
    });

    it('Should not throw an error, if no Identity is given', async (): Promise<void> => {
      try {
        await processInstanceStateHandlingFacade.sendProcessInstanceFinishedNotification(undefined, sampleProcessInstanceConfig, sampleResultToken);
      } catch (error) {
        should.fail(error, undefined, 'Did not expect an error here!');
      }
    });

    it('Should not throw an error, if the ProcessInstanceConfig is missing some properties', async (): Promise<void> => {

      const faultyProcessInstanceConfig = clone(sampleProcessInstanceConfig);

      delete faultyProcessInstanceConfig.correlationId;
      delete faultyProcessInstanceConfig.processModelId;
      delete faultyProcessInstanceConfig.processInstanceId;

      try {
        await processInstanceStateHandlingFacade
          .sendProcessInstanceFinishedNotification(sampleIdentity, sampleProcessInstanceConfig, sampleResultToken);
      } catch (error) {
        should.fail('received result', undefined, 'Did not expect an error here!');
      }
    });
  });
});
