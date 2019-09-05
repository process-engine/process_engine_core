import * as clone from 'clone';
import * as should from 'should';

import {ProcessErrorMessage} from '@process-engine/process_engine_contracts';

import {IProcessInstanceConfig} from '../../../src/runtime/facades/iprocess_instance_config';
import {ProcessInstanceStateHandlingFacade} from '../../../src/runtime/facades/process_instance_state_handling_facade';
import {EventAggregatorMock} from '../../mocks';
import {TestFixtureProvider} from '../../test_fixture_provider';

describe('ProcessInstanceStateHandlingFacade.sendProcessInstanceErrorNotification', (): void => {

  let fixtureProvider: TestFixtureProvider;

  const sampleIdentity = {
    userId: 'userId',
    token: 'dsöfhpadfsghösjbgsöjghbdlögdfg',
  };

  let sampleProcessInstanceConfig: IProcessInstanceConfig;

  const sampleError = new Error('I am an error');

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

    it('Should publish the correct events on the event aggregator', async (): Promise<void> => {

      let globalEventReceived = false;
      let globalEventPayload: ProcessErrorMessage;

      let instanceEventReceived = false;
      let instanceEventPayload: ProcessErrorMessage;

      const callback = (eventName: string, payload: ProcessErrorMessage): void => {
        const expectedGlobalEventName = 'process_error';
        const expectedInstanceEventName = `/processengine/process/${sampleProcessInstanceConfig.processInstanceId}/error`;

        if (eventName === expectedGlobalEventName) {
          globalEventReceived = true;
          globalEventPayload = payload;
        } else if (eventName === expectedInstanceEventName) {
          instanceEventReceived = true;
          instanceEventPayload = payload;
        }
      };

      const eventAggregatorMock = new EventAggregatorMock();
      eventAggregatorMock.publish = callback;

      const processInstanceStateHandlingFacade = fixtureProvider.createProcessInstanceStateHandlingFacade(undefined, eventAggregatorMock);
      processInstanceStateHandlingFacade.sendProcessInstanceErrorNotification(sampleIdentity, sampleProcessInstanceConfig, sampleError);

      await new Promise((resolve): any => setTimeout(resolve, 100));

      should(globalEventReceived).be.true();
      should(instanceEventReceived).be.true();
      assertPayload(globalEventPayload);
      assertPayload(instanceEventPayload);
    });

  });

  describe('Sanity Checks', (): void => {

    let processInstanceStateHandlingFacade: ProcessInstanceStateHandlingFacade;

    before((): void => {
      processInstanceStateHandlingFacade = fixtureProvider.createProcessInstanceStateHandlingFacade();
    });

    it('Should throw an error, if no ProcessInstanceConfig is provided', async (): Promise<void> => {
      try {
        await processInstanceStateHandlingFacade.sendProcessInstanceErrorNotification(sampleIdentity, undefined, sampleError);
        should.fail('received result', undefined, 'Expected this test to cause an error!');
      } catch (error) {
        should(error).be.instanceOf(Error);
      }
    });

    it('Should not throw an error, if no Identity is given', async (): Promise<void> => {
      try {
        await processInstanceStateHandlingFacade.sendProcessInstanceErrorNotification(undefined, sampleProcessInstanceConfig, sampleError);
      } catch (error) {
        should.fail(error, undefined, 'Did not expect an error here!');
      }
    });

    it('Should not throw an error, if no error object is given', async (): Promise<void> => {
      try {
        await processInstanceStateHandlingFacade.sendProcessInstanceErrorNotification(sampleIdentity, sampleProcessInstanceConfig, undefined);
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
          .sendProcessInstanceErrorNotification(sampleIdentity, sampleProcessInstanceConfig, sampleError);
      } catch (error) {
        should.fail('received result', undefined, 'Did not expect an error here!');
      }
    });
  });

  function assertPayload(message: ProcessErrorMessage): void {
    should(message.correlationId).be.eql(sampleProcessInstanceConfig.correlationId);
    should(message.currentToken).be.eql(sampleError);
    should(message.processInstanceId).be.eql(sampleProcessInstanceConfig.processInstanceId);
    should(message.processInstanceOwner).be.eql(sampleIdentity);
    should(message.processModelId).be.eql(sampleProcessInstanceConfig.processModelId);
  }
});
