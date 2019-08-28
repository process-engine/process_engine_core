/* eslint-disable dot-notation */
import * as clone from 'clone';
import * as should from 'should';

import {IIdentity} from '@essential-projects/iam_contracts';
import {IFlowNodeInstanceResult} from '@process-engine/process_engine_contracts';

import {IProcessInstanceConfig} from '../../src/runtime/facades/iprocess_instance_config';
import {ProcessInstanceStateHandlingFacade} from '../../src/runtime/facades/process_instance_state_handling_facade';
import {TestFixtureProvider} from '../test_fixture_provider';

describe('ProcessInstanceStateHandlingFacade.finishProcessInstanceInCorrelation', (): void => {

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

  describe('Execution', (): void => {

    beforeEach((): void => {
      processInstanceStateHandlingFacade = fixtureProvider.createProcessInstanceStateHandlingFacade();
    });

    it('should pass all information to the CorrelationService.', async (): Promise<void> => {

      return new Promise(async (resolve): Promise<void> => {

        processInstanceStateHandlingFacade.logProcessFinished = (): void => {};
        processInstanceStateHandlingFacade.sendProcessInstanceFinishedNotification = (): void => {};

        const callback = (identity: IIdentity, correlationId: string, processInstanceId: string): any => {
          should(identity).be.eql(sampleIdentity);
          should(correlationId).be.eql(sampleProcessInstanceConfig.correlationId);
          should(processInstanceId).be.eql(sampleProcessInstanceConfig.processInstanceId);
          resolve();
        };

        // This property is private and must be accessed with this type of notation to avoid transpliation errors.
        processInstanceStateHandlingFacade['correlationService'].finishProcessInstanceInCorrelation = callback;

        await processInstanceStateHandlingFacade.finishProcessInstanceInCorrelation(sampleIdentity, sampleProcessInstanceConfig, sampleResultToken);
      });
    });

    it('should log that a new ProcessInstance was finished', async (): Promise<void> => {

      return new Promise(async (resolve): Promise<void> => {

        processInstanceStateHandlingFacade.sendProcessInstanceFinishedNotification = (): void => {};

        const callback = (correlationId: string, processModelId: string, processInstanceId: string): void => {
          should(correlationId).be.eql(sampleProcessInstanceConfig.correlationId);
          should(processModelId).be.eql(sampleProcessInstanceConfig.processModelId);
          should(processInstanceId).be.equal(sampleProcessInstanceConfig.processInstanceId);
          resolve();
        };

        processInstanceStateHandlingFacade.logProcessFinished = callback;

        await processInstanceStateHandlingFacade.finishProcessInstanceInCorrelation(sampleIdentity, sampleProcessInstanceConfig, sampleResultToken);
      });
    });

    it('should send the notification about finishing the ProcessInstance', async (): Promise<void> => {

      return new Promise(async (resolve): Promise<void> => {

        processInstanceStateHandlingFacade.logProcessFinished = (): void => {};

        const callback = (identity: IIdentity, processInstanceConfig: IProcessInstanceConfig, resultToken: IFlowNodeInstanceResult): void => {
          should(identity).be.eql(sampleIdentity);
          should(processInstanceConfig).be.eql(sampleProcessInstanceConfig);
          should(resultToken).be.equal(sampleResultToken);
          resolve();
        };

        processInstanceStateHandlingFacade.sendProcessInstanceFinishedNotification = callback;

        await processInstanceStateHandlingFacade.finishProcessInstanceInCorrelation(sampleIdentity, sampleProcessInstanceConfig, sampleResultToken);
      });
    });
  });

  describe('Sanity Checks', (): void => {

    before((): void => {
      processInstanceStateHandlingFacade = fixtureProvider.createProcessInstanceStateHandlingFacade();
      processInstanceStateHandlingFacade.logProcessFinished = (): void => {};
      processInstanceStateHandlingFacade.sendProcessInstanceFinishedNotification = (): void => {};
    });

    it('Should throw an error, if no ProcessInstanceConfig is provided', async (): Promise<void> => {
      try {
        await processInstanceStateHandlingFacade.finishProcessInstanceInCorrelation(sampleIdentity, undefined, sampleResultToken);
        should.fail('received result', undefined, 'Expected this test to cause an error!');
      } catch (error) {
        should(error).be.instanceOf(Error);
      }
    });

    it('Should not throw an error, if no Identity is given', async (): Promise<void> => {
      try {
        await processInstanceStateHandlingFacade.finishProcessInstanceInCorrelation(undefined, sampleProcessInstanceConfig, sampleResultToken);
      } catch (error) {
        should.fail(error, undefined, 'Did not expect an error here!');
      }
    });

    it('Should not throw an error, if no result is given', async (): Promise<void> => {
      try {
        await processInstanceStateHandlingFacade.finishProcessInstanceInCorrelation(sampleIdentity, sampleProcessInstanceConfig, undefined);
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
        await processInstanceStateHandlingFacade.finishProcessInstanceInCorrelation(sampleIdentity, sampleProcessInstanceConfig, sampleResultToken);
      } catch (error) {
        should.fail('received result', undefined, 'Did not expect an error here!');
      }
    });

  });
});
