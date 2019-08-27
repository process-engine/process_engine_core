/* eslint-disable dot-notation */
import * as should from 'should';

import {ProcessErrorMessage} from '@process-engine/process_engine_contracts';

import {IProcessInstanceConfig} from '../../src/runtime/facades/iprocess_instance_config';
import {ProcessInstanceStateHandlingFacade} from '../../src/runtime/facades/process_instance_state_handling_facade';
import {TestFixtureProvider} from '../test_fixture_provider';

describe('ProcessInstanceStateHandlingFacade.sendProcessInstanceErrorNotification', (): void => {

  let fixtureProvider: TestFixtureProvider;
  let processInstanceStateHandlingFacade: ProcessInstanceStateHandlingFacade;

  const sampleIdentity = {
    userId: 'userId',
    token: 'dsöfhpadfsghösjbgsöjghbdlögdfg',
  };

  let sampleProcessInstanceConfig: IProcessInstanceConfig;

  const sampleError = new Error('Hello, I am an error and I am here to screw you.');

  before(async (): Promise<void> => {
    fixtureProvider = new TestFixtureProvider();
    await fixtureProvider.initialize();

    processInstanceStateHandlingFacade = fixtureProvider.createProcessInstanceStateHandlingFacade();

    sampleProcessInstanceConfig = {
      correlationId: 'correlationId',
      processModelId: 'processModelId',
      processInstanceId: 'processInstanceId',
      parentProcessInstanceId: 'parentProcessInstanceId',
      processModelFacade: fixtureProvider.createProcessModelFacade(undefined),
      startEvent: {id: 'startevent'} as any,
      startEventInstance: {id: 'flowNodeInstanceId'} as any,
      processToken: {payload: {some: 'value'}} as any,
      processTokenFacade: fixtureProvider.createProcessTokenFacade(),
    };
  });

  it('should publish the correct events on the event aggregator', async (): Promise<void> => {

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

    processInstanceStateHandlingFacade['eventAggregator'].publish = callback;

    processInstanceStateHandlingFacade.sendProcessInstanceErrorNotification(sampleIdentity, sampleProcessInstanceConfig, sampleError);

    await new Promise((resolve): any => setTimeout(resolve, 100));

    should(globalEventReceived).be.true();
    should(instanceEventReceived).be.true();
    assertPayload(globalEventPayload);
    assertPayload(instanceEventPayload);
  });

  function assertPayload(message: ProcessErrorMessage): void {
    should(message.correlationId).be.eql(sampleProcessInstanceConfig.correlationId);
    should(message.currentToken).be.eql(sampleError);
    should(message.processInstanceId).be.eql(sampleProcessInstanceConfig.processInstanceId);
    should(message.processInstanceOwner).be.eql(sampleIdentity);
    should(message.processModelId).be.eql(sampleProcessInstanceConfig.processModelId);
  }
});
