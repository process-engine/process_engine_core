import * as should from 'should';

import {LogLevel, MetricMeasurementPoint} from '@process-engine/logging_api_contracts';

import {LoggingServiceMock} from '../../mocks';
import {TestFixtureProvider} from '../../test_fixture_provider';

describe('ProcessInstanceStateHandlingFacade.logProcessError', (): void => {

  let fixtureProvider: TestFixtureProvider;

  const sampleCorrelationId = 'correlationId';
  const sampleProcessModelId = 'processModelId';
  const sampleProcessInstanceId = 'processInstanceId';

  const sampleError = new Error('I want you to crash.');

  before(async (): Promise<void> => {
    fixtureProvider = new TestFixtureProvider();
    await fixtureProvider.initialize();
  });

  it('Should pass all information to the LoggingService', async (): Promise<void> => {

    return new Promise(async (resolve, reject): Promise<void> => {

      const loggingApiServiceMock = new LoggingServiceMock();
      loggingApiServiceMock.writeLogForProcessModel = (
        correlationId: string,
        processModelId: string,
        processInstanceId: string,
        logLevel: LogLevel,
        measuredAt: MetricMeasurementPoint,
        message?: string,
      ): any => {

        should(correlationId).be.eql(sampleCorrelationId);
        should(processModelId).be.eql(sampleProcessModelId);
        should(processInstanceId).be.eql(sampleProcessInstanceId);
        should(logLevel).be.equal(LogLevel.error);
        should(measuredAt).be.equal(MetricMeasurementPoint.onProcessError);
        should(message).be.equal('ProcessInstance exited with an error: I want you to crash.');
        resolve();
      };

      const processInstanceStateHandlingFacade =
        fixtureProvider.createProcessInstanceStateHandlingFacade(undefined, undefined, loggingApiServiceMock);

      await processInstanceStateHandlingFacade
        .logProcessError(sampleCorrelationId, sampleProcessModelId, sampleProcessInstanceId, sampleError);
    });
  });

});
