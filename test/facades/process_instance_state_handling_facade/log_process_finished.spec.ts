import * as moment from 'moment';
import * as should from 'should';

import {LogLevel} from '@process-engine/logging_api_contracts';

import {LoggingServiceMock, MetricsServiceMock} from '../../mocks';
import {TestFixtureProvider} from '../../test_fixture_provider';

describe('ProcessInstanceStateHandlingFacade.logProcessFinished', (): void => {

  let fixtureProvider: TestFixtureProvider;

  const sampleCorrelationId = 'correlationId';
  const sampleProcessModelId = 'processModelId';
  const sampleProcessInstanceId = 'processInstanceId';

  before(async (): Promise<void> => {
    fixtureProvider = new TestFixtureProvider();
    await fixtureProvider.initialize();
  });

  describe('Execution', (): void => {

    it('Should pass all information to the LoggingService', async (): Promise<void> => {

      return new Promise(async (resolve, reject): Promise<void> => {

        const loggingApiServiceMock = new LoggingServiceMock();
        loggingApiServiceMock.writeLogForProcessModel = (
          correlationId: string,
          processModelId: string,
          processInstanceId: string,
          logLevel: LogLevel,
          message: string,
        ): any => {

          should(correlationId).be.eql(sampleCorrelationId);
          should(processModelId).be.eql(sampleProcessModelId);
          should(processInstanceId).be.eql(sampleProcessInstanceId);
          should(logLevel).be.equal(LogLevel.info);
          should(message).be.equal('Process instance finished.');
          resolve();
        };

        const processInstanceStateHandlingFacade =
          fixtureProvider.createProcessInstanceStateHandlingFacade(undefined, undefined, loggingApiServiceMock);

        await processInstanceStateHandlingFacade
          .logProcessFinished(sampleCorrelationId, sampleProcessModelId, sampleProcessInstanceId);
      });
    });

    it('Should pass all information to the MetricsService', async (): Promise<void> => {

      return new Promise(async (resolve, reject): Promise<void> => {

        const metricsApiServiceMock = new MetricsServiceMock();
        metricsApiServiceMock.writeOnProcessFinished = (
          correlationId: string,
          processInstanceId: string,
          processModelId: string,
          timeStamp: moment.Moment,
        ): any => {

          const receivedTimeStamp = timeStamp.format('DD.MM.YYYY HH:mm:ss');
          const now = moment.utc().format('DD.MM.YYYY HH:mm:ss');

          should(correlationId).be.eql(sampleCorrelationId);
          should(processInstanceId).be.eql(sampleProcessInstanceId);
          should(processModelId).be.eql(sampleProcessModelId);
          should(receivedTimeStamp).be.equal(now);
          resolve();
        };

        const processInstanceStateHandlingFacade =
          fixtureProvider.createProcessInstanceStateHandlingFacade(undefined, undefined, undefined, metricsApiServiceMock);

        await processInstanceStateHandlingFacade
          .logProcessFinished(sampleCorrelationId, sampleProcessModelId, sampleProcessInstanceId);
      });
    });
  });
});
