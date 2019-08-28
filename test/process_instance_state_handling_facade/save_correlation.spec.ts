/* eslint-disable dot-notation */
import * as clone from 'clone';
import * as should from 'should';

import {IIdentity} from '@essential-projects/iam_contracts';

import {IProcessInstanceConfig} from '../../src/runtime/facades/iprocess_instance_config';
import {ProcessInstanceStateHandlingFacade} from '../../src/runtime/facades/process_instance_state_handling_facade';
import {TestFixtureProvider} from '../test_fixture_provider';

describe('ProcessInstanceStateHandlingFacade.saveCorrelation', (): void => {

  let fixtureProvider: TestFixtureProvider;
  let processInstanceStateHandlingFacade: ProcessInstanceStateHandlingFacade;

  const sampleIdentity = {
    userId: 'userId',
    token: 'dsöfhpadfsghösjbgsöjghbdlögdfg',
  };

  let sampleProcessInstanceConfig: IProcessInstanceConfig;

  const sampleProcessDefinition = {
    name: 'sample_proces_model',
    hash: 'xyz',
    xml: '',
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

    before((): void => {
      processInstanceStateHandlingFacade = fixtureProvider.createProcessInstanceStateHandlingFacade();
      processInstanceStateHandlingFacade['processModelUseCases'].getProcessDefinitionAsXmlByName = (): Promise<any> => {
        return Promise.resolve(sampleProcessDefinition);
      };
    });

    it('should pass all information to the CorrelationService.', async (): Promise<void> => {

      return new Promise(async (resolve): Promise<void> => {

        const callback = (
          identity: IIdentity,
          correlationId: string,
          processInstanceId: string,
          name: string,
          hash: string,
          parentProcessInstanceId: string,
        ): any => {
          should(identity).be.eql(sampleIdentity);
          should(correlationId).be.eql(sampleProcessInstanceConfig.correlationId);
          should(processInstanceId).be.eql(sampleProcessInstanceConfig.processInstanceId);
          should(name).be.eql(sampleProcessDefinition.name);
          should(hash).be.eql(sampleProcessDefinition.hash);
          should(parentProcessInstanceId).be.equal(sampleProcessInstanceConfig.parentProcessInstanceId);
          resolve();
        };

        // This property is private and must be accessed with this type of notation to avoid transpliation errors.
        processInstanceStateHandlingFacade['correlationService'].createEntry = callback;

        await processInstanceStateHandlingFacade.saveCorrelation(sampleIdentity, sampleProcessInstanceConfig);
      });
    });

    it('should log that a new ProcessInstance was started', async (): Promise<void> => {

      return new Promise(async (resolve): Promise<void> => {

        const callback = (correlationId: string, processModelId: string, processInstanceId: string): void => {
          should(correlationId).be.eql(sampleProcessInstanceConfig.correlationId);
          should(processModelId).be.eql(sampleProcessInstanceConfig.processModelId);
          should(processInstanceId).be.equal(sampleProcessInstanceConfig.processInstanceId);
          resolve();
        };

        processInstanceStateHandlingFacade.logProcessStarted = callback;

        await processInstanceStateHandlingFacade.saveCorrelation(sampleIdentity, sampleProcessInstanceConfig);
      });
    });
  });

  describe('Sanity Checks', (): void => {

    beforeEach((): void => {
      processInstanceStateHandlingFacade = fixtureProvider.createProcessInstanceStateHandlingFacade();
    });

    it('Should throw an error, if the retrieved ProcessModel is missing essential data', async (): Promise<void> => {

      processInstanceStateHandlingFacade['processModelUseCases'].getProcessDefinitionAsXmlByName = (): Promise<any> => {
        return Promise.resolve(undefined);
      };

      try {
        await processInstanceStateHandlingFacade.saveCorrelation(sampleIdentity, sampleProcessInstanceConfig);
        should.fail('received result', undefined, 'Expected this test to cause an error!');
      } catch (error) {
        should(error).be.instanceOf(Error);
      }
    });

    it('Should throw an error, if no ProcessInstanceConfig is provided', async (): Promise<void> => {
      try {
        await processInstanceStateHandlingFacade.saveCorrelation(sampleIdentity, undefined);
        should.fail('received result', undefined, 'Expected this test to cause an error!');
      } catch (error) {
        should(error).be.instanceOf(Error);
      }
    });

    it('Should not throw an error, if no Identity is given (not the responsibility of this function)', async (): Promise<void> => {
      try {
        await processInstanceStateHandlingFacade.saveCorrelation(undefined, sampleProcessInstanceConfig);
      } catch (error) {
        should.fail('received result', undefined, 'Did not expect an error here!');
      }
    });

    // eslint-disable-next-line max-len
    it('Should not throw an error, if the ProcessInstanceConfig is missing some properties (not the responsibility of this function)', async (): Promise<void> => {

      const faultyProcessInstanceConfig = clone(sampleProcessInstanceConfig);

      delete faultyProcessInstanceConfig.correlationId;
      delete faultyProcessInstanceConfig.processModelId;
      delete faultyProcessInstanceConfig.processInstanceId;

      try {
        await processInstanceStateHandlingFacade.saveCorrelation(sampleIdentity, sampleProcessInstanceConfig);
      } catch (error) {
        should.fail('received result', undefined, 'Did not expect an error here!');
      }
    });

  });
});
