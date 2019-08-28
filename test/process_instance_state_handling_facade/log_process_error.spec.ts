/* eslint-disable dot-notation */
import * as moment from 'moment';
import * as should from 'should';

import {LogLevel} from '@process-engine/logging_api_contracts';

import {ProcessInstanceStateHandlingFacade} from '../../src/runtime/facades/process_instance_state_handling_facade';
import {TestFixtureProvider} from '../test_fixture_provider';

describe('ProcessInstanceStateHandlingFacade.logProcessError', (): void => {

  let fixtureProvider: TestFixtureProvider;
  let processInstanceStateHandlingFacade: ProcessInstanceStateHandlingFacade;

  const sampleCorrelationId = 'correlationId';
  const sampleProcessModelId = 'processModelId';
  const sampleProcessInstanceId = 'processInstanceId';

  const sampleError = new Error('I want you to crash.');

  before(async (): Promise<void> => {
    fixtureProvider = new TestFixtureProvider();
    await fixtureProvider.initialize();
  });

  describe('Execution', (): void => {

    beforeEach((): void => {
      processInstanceStateHandlingFacade = fixtureProvider.createProcessInstanceStateHandlingFacade();
    });

    it('should pass all information to the LoggingService', async (): Promise<void> => {

      return new Promise(async (resolve, reject): Promise<void> => {

        const callback = (
          correlationId: string,
          processModelId: string,
          processInstanceId: string,
          logLevel: LogLevel,
          message: string,
        ): any => {

          should(correlationId).be.eql(sampleCorrelationId);
          should(processModelId).be.eql(sampleProcessModelId);
          should(processInstanceId).be.eql(sampleProcessInstanceId);
          should(logLevel).be.equal(LogLevel.error);
          should(message).be.equal(sampleError.message);
          resolve();
        };

        // This property is private and must be accessed with this type of notation to avoid transpliation errors.
        processInstanceStateHandlingFacade['loggingApiService'].writeLogForProcessModel = callback;

        await processInstanceStateHandlingFacade
          .logProcessError(sampleCorrelationId, sampleProcessModelId, sampleProcessInstanceId, sampleError);
      });
    });

    it('should pass all information to the MetricsService', async (): Promise<void> => {

      return new Promise(async (resolve, reject): Promise<void> => {

        const callback = (
          correlationId: string,
          processInstanceId: string,
          processModelId: string,
          error: Error,
          timeStamp: moment.Moment,
        ): any => {

          const receivedTimeStamp = timeStamp.format('DD.MM.YYYY HH:mm:ss');
          const now = moment.utc().format('DD.MM.YYYY HH:mm:ss');

          should(correlationId).be.eql(sampleCorrelationId);
          should(processInstanceId).be.eql(sampleProcessInstanceId);
          should(processModelId).be.eql(sampleProcessModelId);
          should(error).be.eql(sampleError);
          should(receivedTimeStamp).be.equal(now);
          resolve();
        };

        // This property is private and must be accessed with this type of notation to avoid transpliation errors.
        processInstanceStateHandlingFacade['metricsApiService'].writeOnProcessError = callback;

        await processInstanceStateHandlingFacade
          .logProcessError(sampleCorrelationId, sampleProcessModelId, sampleProcessInstanceId, sampleError);
      });
    });
  });
});
