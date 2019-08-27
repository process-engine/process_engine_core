/* eslint-disable dot-notation */
import * as should from 'should';

import {IIdentity} from '@essential-projects/iam_contracts';

import {IProcessInstanceConfig} from '../../src/runtime/facades/iprocess_instance_config';
import {ProcessInstanceStateHandlingFacade} from '../../src/runtime/facades/process_instance_state_handling_facade';
import {TestFixtureProvider} from '../test_fixture_provider';

describe('ProcessInstanceStateHandlingFacade.finishProcessInstanceInCorrelationWithError', (): void => {

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

  it('should pass all information to the CorrelationService.', async (): Promise<void> => {

    return new Promise(async (resolve): Promise<void> => {

      const callback = (identity: IIdentity, correlationId: string, processInstanceId: string): any => {
        should(identity).be.eql(sampleIdentity);
        should(correlationId).be.eql(sampleProcessInstanceConfig.correlationId);
        should(processInstanceId).be.eql(sampleProcessInstanceConfig.processInstanceId);
        resolve();
      };

      // This property is private and must be accessed with this type of notation to avoid transpliation errors.
      processInstanceStateHandlingFacade['correlationService'].finishProcessInstanceInCorrelationWithError = callback;

      await processInstanceStateHandlingFacade.finishProcessInstanceInCorrelationWithError(sampleIdentity, sampleProcessInstanceConfig, sampleError);
    });
  });

  it('should log that a new ProcessInstance was finished', async (): Promise<void> => {

    return new Promise(async (resolve): Promise<void> => {

      const callback = (correlationId: string, processModelId: string, processInstanceId: string): void => {
        should(correlationId).be.eql(sampleProcessInstanceConfig.correlationId);
        should(processModelId).be.eql(sampleProcessInstanceConfig.processModelId);
        should(processInstanceId).be.equal(sampleProcessInstanceConfig.processInstanceId);
        resolve();
      };

      processInstanceStateHandlingFacade.logProcessError = callback;

      await processInstanceStateHandlingFacade.finishProcessInstanceInCorrelationWithError(sampleIdentity, sampleProcessInstanceConfig, sampleError);
    });
  });

  it('should send the notification about finishing the ProcessInstance', async (): Promise<void> => {

    return new Promise(async (resolve): Promise<void> => {

      const callback = (identity: IIdentity, processInstanceConfig: IProcessInstanceConfig, error: Error): void => {
        should(identity).be.eql(sampleIdentity);
        should(processInstanceConfig).be.eql(sampleProcessInstanceConfig);
        should(error).be.equal(sampleError);
        resolve();
      };

      processInstanceStateHandlingFacade.sendProcessInstanceErrorNotification = callback;

      await processInstanceStateHandlingFacade.finishProcessInstanceInCorrelationWithError(sampleIdentity, sampleProcessInstanceConfig, sampleError);
    });
  });
});
