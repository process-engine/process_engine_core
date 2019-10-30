import * as should from 'should';

import {LogLevel, MetricMeasurementPoint} from '@process-engine/logging_api_contracts';

import {FlowNodeInstanceServiceMock, LoggingServiceMock} from '../../mocks';
import {TestFixtureProvider} from '../../test_fixture_provider';

describe('FlowNodePersistenceFacade.persistOnEnter', (): void => {

  let fixtureProvider: TestFixtureProvider;

  const sampleFlowNode = {
    id: 'asdasd',
  };
  const sampleToken = {
    correlationId: 'correlationId',
    processModelId: 'processModelId',
    processInstanceId: 'processInstanceId',
    payload: {sample: 'value'},
  };
  const sampleFlowNodeInstanceId = '12312312321123';
  const samplePreviousFlowNodeInstanceId = '44444444444';

  before(async (): Promise<void> => {
    fixtureProvider = new TestFixtureProvider();
    await fixtureProvider.initialize();
  });

  it('Should pass all information to the FlowNodeInstanceService.', async (): Promise<void> => {

    return new Promise(async (resolve, reject): Promise<void> => {

      const flowNodeInstanceServiceMock = new FlowNodeInstanceServiceMock();
      flowNodeInstanceServiceMock.persistOnEnter =
        (flowNode: any, flowNodeInstanceId: string, processToken: any, previousFlowNodeInstanceId: string): any => {

          should(flowNode).be.eql(sampleFlowNode);
          should(flowNodeInstanceId).be.equal(sampleFlowNodeInstanceId);
          should(processToken).be.eql(sampleToken);
          should(previousFlowNodeInstanceId).be.equal(samplePreviousFlowNodeInstanceId);
          resolve();
        };

      const flowNodePersistenceFacade = fixtureProvider.createFlowNodePersistenceFacade(flowNodeInstanceServiceMock);

      await flowNodePersistenceFacade
        .persistOnEnter(sampleFlowNode as any, sampleFlowNodeInstanceId, sampleToken as any, samplePreviousFlowNodeInstanceId);
    });
  });

  it('Should pass all information to the LoggingService', async (): Promise<void> => {

    return new Promise(async (resolve, reject): Promise<void> => {

      const loggingServiceMock = new LoggingServiceMock();
      loggingServiceMock.writeLogForFlowNode = (
        correlationId: string,
        processModelId: string,
        processInstanceId: string,
        flowNodeInstanceId: string,
        flowNodeId: string,
        logLevel: LogLevel,
        measuredAt: MetricMeasurementPoint,
        tokenPayload: any,
        message?: string,
      ): any => {

        should(correlationId).be.eql(sampleToken.correlationId);
        should(processModelId).be.eql(sampleToken.processModelId);
        should(processInstanceId).be.eql(sampleToken.processInstanceId);
        should(flowNodeInstanceId).be.eql(sampleFlowNodeInstanceId);
        should(flowNodeId).be.eql(sampleFlowNode.id);
        should(logLevel).be.equal(LogLevel.info);
        should(measuredAt).be.equal(MetricMeasurementPoint.onFlowNodeEnter);
        should(message).be.equal('Flow Node execution started.');
        resolve();
      };

      const flowNodePersistenceFacade = fixtureProvider.createFlowNodePersistenceFacade(undefined, loggingServiceMock);

      await flowNodePersistenceFacade
        .persistOnEnter(sampleFlowNode as any, sampleFlowNodeInstanceId, sampleToken as any, samplePreviousFlowNodeInstanceId);
    });

  });
});
