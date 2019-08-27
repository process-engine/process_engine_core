/* eslint-disable dot-notation */
import * as moment from 'moment';
import * as should from 'should';

import {LogLevel} from '@process-engine/logging_api_contracts';

import {FlowNodePersistenceFacade} from '../../src/runtime/facades/flow_node_persistence_facade';
import {TestFixtureProvider} from '../test_fixture_provider';

describe('FlowNodePersistenceFacade.persistOnError', (): void => {

  let fixtureProvider: TestFixtureProvider;
  let flowNodePersistenceFacade: FlowNodePersistenceFacade;

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
  const sampleError = new Error('I am a sample error.');

  before(async (): Promise<void> => {
    fixtureProvider = new TestFixtureProvider();
    await fixtureProvider.initialize();

    flowNodePersistenceFacade = fixtureProvider.createFlowNodePersistenceFacade();
  });

  it('should pass all information to the FlowNodeInstanceService.', async (): Promise<void> => {

    return new Promise(async (resolve, reject): Promise<void> => {

      // This property is private and must be accessed with this type of notation to avoid transpliation errors.
      flowNodePersistenceFacade['flowNodeInstanceService'].persistOnError =
        (flowNode: any, flowNodeInstanceId: string, processToken: any, error: Error): any => {

          should(flowNode).be.eql(sampleFlowNode);
          should(flowNodeInstanceId).be.equal(sampleFlowNodeInstanceId);
          should(processToken).be.eql(sampleToken);
          resolve();
        };

      await flowNodePersistenceFacade
        .persistOnError(sampleFlowNode as any, sampleFlowNodeInstanceId, sampleToken as any, sampleError);
    });
  });

  it('should pass all information to the LoggingService', async (): Promise<void> => {

    return new Promise(async (resolve, reject): Promise<void> => {

      const callback = (
        correlationId: string,
        processModelId: string,
        processInstanceId: string,
        flowNodeInstanceId: string,
        flowNodeId: string,
        logLevel: LogLevel,
        message: string,
      ): any => {

        should(correlationId).be.eql(sampleToken.correlationId);
        should(processModelId).be.eql(sampleToken.processModelId);
        should(processInstanceId).be.eql(sampleToken.processInstanceId);
        should(flowNodeInstanceId).be.eql(sampleFlowNodeInstanceId);
        should(flowNodeId).be.eql(sampleFlowNode.id);
        should(logLevel).be.equal(LogLevel.error);
        should(message).be.equal(`Flow Node execution failed: ${sampleError.message}`);
        resolve();
      };

      // This property is private and must be accessed with this type of notation to avoid transpliation errors.
      flowNodePersistenceFacade['loggingApiService'].writeLogForFlowNode = callback;

      await flowNodePersistenceFacade
        .persistOnError(sampleFlowNode as any, sampleFlowNodeInstanceId, sampleToken as any, sampleError);
    });

  });

  it('should pass all information to the MetricsService', async (): Promise<void> => {

    return new Promise(async (resolve, reject): Promise<void> => {

      const callback = (
        correlationId: string,
        processInstanceId: string,
        processModelId: string,
        flowNodeInstanceId: string,
        flowNodeId: string,
        payload: any,
        error: Error,
        timeStamp: moment.Moment,
      ): any => {

        const receivedTimeStamp = timeStamp.format('DD.MM.YYYY HH:mm:ss');
        const now = moment.utc().format('DD.MM.YYYY HH:mm:ss');

        should(correlationId).be.eql(sampleToken.correlationId);
        should(processInstanceId).be.eql(sampleToken.processInstanceId);
        should(processModelId).be.eql(sampleToken.processModelId);
        should(flowNodeInstanceId).be.eql(sampleFlowNodeInstanceId);
        should(flowNodeId).be.eql(sampleFlowNode.id);
        should(payload).be.equal(sampleToken.payload);
        should(error).be.eql(sampleError);
        should(receivedTimeStamp).be.equal(now);
        resolve();
      };

      // This property is private and must be accessed with this type of notation to avoid transpliation errors.
      flowNodePersistenceFacade['metricsApiService'].writeOnFlowNodeInstanceError = callback;

      await flowNodePersistenceFacade
        .persistOnError(sampleFlowNode as any, sampleFlowNodeInstanceId, sampleToken as any, sampleError);
    });

  });
});
