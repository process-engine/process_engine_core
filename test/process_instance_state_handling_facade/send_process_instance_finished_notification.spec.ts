/* eslint-disable dot-notation */
import * as should from 'should';

import {IFlowNodeInstanceResult, ProcessEndedMessage} from '@process-engine/process_engine_contracts';

import {IProcessInstanceConfig} from '../../src/runtime/facades/iprocess_instance_config';
import {ProcessInstanceStateHandlingFacade} from '../../src/runtime/facades/process_instance_state_handling_facade';
import {TestFixtureProvider} from '../test_fixture_provider';

describe('ProcessInstanceStateHandlingFacade.sendProcessInstanceFinishedNotification', (): void => {

  let fixtureProvider: TestFixtureProvider;
  let processInstanceStateHandlingFacade: ProcessInstanceStateHandlingFacade;

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

  it('should publish the correct event on the event aggregator', async (): Promise<void> => {

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

      processInstanceStateHandlingFacade['eventAggregator'].publish = callback;

      await processInstanceStateHandlingFacade
        .sendProcessInstanceFinishedNotification(sampleIdentity, sampleProcessInstanceConfig, sampleResultToken);
    });
  });
});
