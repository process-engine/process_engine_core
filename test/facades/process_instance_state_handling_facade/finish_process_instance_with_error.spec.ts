import * as clone from 'clone';
import * as should from 'should';

import {InternalServerError} from '@essential-projects/errors_ts';

import {IIdentity} from '@essential-projects/iam_contracts';

import {IProcessInstanceConfig} from '../../../src/runtime/facades/iprocess_instance_config';
import {ProcessInstanceStateHandlingFacade} from '../../../src/runtime/facades/process_instance_state_handling_facade';
import {CorrelationServiceMock} from '../../mocks';
import {TestFixtureProvider} from '../../test_fixture_provider';

describe('ProcessInstanceStateHandlingFacade.finishProcessInstanceWithError', (): void => {

  let fixtureProvider: TestFixtureProvider;

  const sampleIdentity = {
    userId: 'userId',
    token: 'dsöfhpadfsghösjbgsöjghbdlögdfg',
  };

  let sampleProcessInstanceConfig: IProcessInstanceConfig;

  const sampleError = new InternalServerError('I am an error');

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

    it('Should pass all information to the CorrelationService.', async (): Promise<void> => {

      return new Promise(async (resolve): Promise<void> => {

        const correlationServiceMock = new CorrelationServiceMock();
        correlationServiceMock.finishProcessInstanceInCorrelationWithError =
          (identity: IIdentity, correlationId: string, processInstanceId: string): any => {
            should(identity).be.eql(sampleIdentity);
            should(correlationId).be.eql(sampleProcessInstanceConfig.correlationId);
            should(processInstanceId).be.eql(sampleProcessInstanceConfig.processInstanceId);
            resolve();
          };

        const processInstanceStateHandlingFacade = fixtureProvider.createProcessInstanceStateHandlingFacade(correlationServiceMock);
        processInstanceStateHandlingFacade.logProcessError = (): void => {};
        processInstanceStateHandlingFacade.sendProcessInstanceErrorNotification = (): void => {};

        await processInstanceStateHandlingFacade
          .finishProcessInstanceWithError(sampleIdentity, sampleProcessInstanceConfig, sampleError);
      });
    });

    it('Should log that a new ProcessInstance was finished with an error', async (): Promise<void> => {

      return new Promise(async (resolve): Promise<void> => {

        const processInstanceStateHandlingFacade = fixtureProvider.createProcessInstanceStateHandlingFacade();
        processInstanceStateHandlingFacade.sendProcessInstanceErrorNotification = (): void => {};

        const callback = (correlationId: string, processModelId: string, processInstanceId: string): void => {
          should(correlationId).be.eql(sampleProcessInstanceConfig.correlationId);
          should(processModelId).be.eql(sampleProcessInstanceConfig.processModelId);
          should(processInstanceId).be.equal(sampleProcessInstanceConfig.processInstanceId);
          resolve();
        };

        processInstanceStateHandlingFacade.logProcessError = callback;

        await processInstanceStateHandlingFacade
          .finishProcessInstanceWithError(sampleIdentity, sampleProcessInstanceConfig, sampleError);
      });
    });

    it('Should send the notification about the errored ProcessInstance', async (): Promise<void> => {

      return new Promise(async (resolve): Promise<void> => {

        const processInstanceStateHandlingFacade = fixtureProvider.createProcessInstanceStateHandlingFacade();
        processInstanceStateHandlingFacade.logProcessError = (): void => {};

        const callback = (identity: IIdentity, processInstanceConfig: IProcessInstanceConfig, error: Error): void => {
          should(identity).be.eql(sampleIdentity);
          should(processInstanceConfig).be.eql(sampleProcessInstanceConfig);
          should(error).be.equal(sampleError);
          resolve();
        };

        processInstanceStateHandlingFacade.sendProcessInstanceErrorNotification = callback;

        await processInstanceStateHandlingFacade
          .finishProcessInstanceWithError(sampleIdentity, sampleProcessInstanceConfig, sampleError);
      });
    });

    it('Should send an onProcessTerminated notification, if the error is from a process termination', async (): Promise<void> => {

      return new Promise(async (resolve): Promise<void> => {

        const processInstanceStateHandlingFacade = fixtureProvider.createProcessInstanceStateHandlingFacade();

        const terminationError = new InternalServerError('Process was terminated');

        processInstanceStateHandlingFacade.logProcessError = (): void => {};

        const callback = (identity: IIdentity, processInstanceConfig: IProcessInstanceConfig, error: Error): void => {
          should(identity).be.eql(sampleIdentity);
          should(processInstanceConfig).be.eql(sampleProcessInstanceConfig);
          should(error).be.equal(terminationError);
          resolve();
        };

        processInstanceStateHandlingFacade.sendProcessInstanceTerminationNotification = callback;

        await processInstanceStateHandlingFacade
          .finishProcessInstanceWithError(sampleIdentity, sampleProcessInstanceConfig, terminationError);
      });
    });

  });

  describe('Sanity Checks', (): void => {

    let processInstanceStateHandlingFacade: ProcessInstanceStateHandlingFacade;

    before((): void => {
      processInstanceStateHandlingFacade = fixtureProvider.createProcessInstanceStateHandlingFacade();
      processInstanceStateHandlingFacade.logProcessError = (): void => {};
      processInstanceStateHandlingFacade.sendProcessInstanceErrorNotification = (): void => {};
    });

    it('Should throw an error, if no ProcessInstanceConfig is provided', async (): Promise<void> => {
      try {
        await processInstanceStateHandlingFacade.finishProcessInstanceWithError(sampleIdentity, undefined, sampleError);
        should.fail('received result', undefined, 'Expected this test to cause an error!');
      } catch (error) {
        should(error).be.instanceOf(Error);
      }
    });

    it('Should throw an error, if no error object is given', async (): Promise<void> => {
      try {
        await processInstanceStateHandlingFacade.finishProcessInstanceWithError(sampleIdentity, sampleProcessInstanceConfig, undefined);
        should.fail('received result', undefined, 'Expected this test to cause an error!');
      } catch (error) {
        should(error).be.instanceOf(Error);
      }
    });

    it('Should not throw an error, if no Identity is given', async (): Promise<void> => {
      try {
        await processInstanceStateHandlingFacade.finishProcessInstanceWithError(undefined, sampleProcessInstanceConfig, sampleError);
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
          .finishProcessInstanceWithError(sampleIdentity, sampleProcessInstanceConfig, sampleError);
      } catch (error) {
        should.fail('received result', undefined, 'Did not expect an error here!');
      }
    });
  });

});
