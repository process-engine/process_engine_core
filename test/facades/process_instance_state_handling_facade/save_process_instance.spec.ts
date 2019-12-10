import * as clone from 'clone';
import * as should from 'should';

import {IIdentity} from '@essential-projects/iam_contracts';

import {IProcessInstanceConfig} from '../../../src/runtime/facades/iprocess_instance_config';
import {ProcessInstanceStateHandlingFacade} from '../../../src/runtime/facades/process_instance_state_handling_facade';
import {CorrelationServiceMock, ProcessModelUseCasesMock} from '../../mocks';
import {TestFixtureProvider} from '../../test_fixture_provider';

describe('ProcessInstanceStateHandlingFacade.saveProcessInstance', (): void => {

  let fixtureProvider: TestFixtureProvider;

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
      processModelFacade: fixtureProvider.createProcessModelFacade({id: 'someId'} as any),
      startEvent: {id: 'startevent'} as any,
      startEventInstance: {id: 'flowNodeInstanceId'} as any,
      processToken: {payload: {some: 'value'}} as any,
      processTokenFacade: fixtureProvider.createProcessTokenFacade(),
    };
  });

  describe('Execution', (): void => {

    function createProcessInstanceStateHandlingFacade(correlationServiceMock?: CorrelationServiceMock): ProcessInstanceStateHandlingFacade {

      const processModelUseCaseMock = new ProcessModelUseCasesMock();
      processModelUseCaseMock.getProcessDefinitionAsXmlByName = (): Promise<any> => {
        return Promise.resolve(sampleProcessDefinition);
      };

      return fixtureProvider
        .createProcessInstanceStateHandlingFacade(correlationServiceMock, undefined, undefined, processModelUseCaseMock);
    }

    it('Should pass all information to the CorrelationService.', async (): Promise<void> => {

      return new Promise(async (resolve): Promise<void> => {

        const correlationServiceMock = new CorrelationServiceMock();
        correlationServiceMock.createEntry = (
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

        const processInstanceStateHandlingFacade = createProcessInstanceStateHandlingFacade(correlationServiceMock);

        await processInstanceStateHandlingFacade.saveProcessInstance(sampleIdentity, sampleProcessInstanceConfig);
      });
    });

    it('Should log that a new ProcessInstance was started', async (): Promise<void> => {

      return new Promise(async (resolve): Promise<void> => {

        const processInstanceStateHandlingFacade = createProcessInstanceStateHandlingFacade();

        const callback = (correlationId: string, processModelId: string, processInstanceId: string): void => {
          should(correlationId).be.eql(sampleProcessInstanceConfig.correlationId);
          should(processModelId).be.eql(sampleProcessInstanceConfig.processModelId);
          should(processInstanceId).be.equal(sampleProcessInstanceConfig.processInstanceId);
          resolve();
        };

        processInstanceStateHandlingFacade.logProcessStarted = callback;

        await processInstanceStateHandlingFacade.saveProcessInstance(sampleIdentity, sampleProcessInstanceConfig);
      });
    });
  });

  describe('Sanity Checks', (): void => {

    it('Should throw an error, if the retrieved ProcessModel is missing essential data', async (): Promise<void> => {

      const processModelUseCaseMock = new ProcessModelUseCasesMock();
      processModelUseCaseMock.getProcessDefinitionAsXmlByName = (): Promise<any> => {
        return Promise.resolve(undefined);
      };

      const processInstanceStateHandlingFacade =
        fixtureProvider.createProcessInstanceStateHandlingFacade(undefined, undefined, undefined, processModelUseCaseMock);

      try {
        await processInstanceStateHandlingFacade.saveProcessInstance(sampleIdentity, sampleProcessInstanceConfig);
        should.fail('received result', undefined, 'Expected this test to cause an error!');
      } catch (error) {
        should(error).be.instanceOf(Error);
      }
    });

    it('Should throw an error, if no ProcessInstanceConfig is provided', async (): Promise<void> => {
      try {
        const processInstanceStateHandlingFacade = fixtureProvider.createProcessInstanceStateHandlingFacade();
        await processInstanceStateHandlingFacade.saveProcessInstance(sampleIdentity, undefined);
        should.fail('received result', undefined, 'Expected this test to cause an error!');
      } catch (error) {
        should(error).be.instanceOf(Error);
      }
    });

    it('Should not throw an error, if no Identity is given', async (): Promise<void> => {
      try {
        const processInstanceStateHandlingFacade = fixtureProvider.createProcessInstanceStateHandlingFacade();
        await processInstanceStateHandlingFacade.saveProcessInstance(undefined, sampleProcessInstanceConfig);
      } catch (error) {
        should.fail('received result', undefined, 'Did not expect an error here!');
      }
    });

    it('Should not throw an error, if the ProcessInstanceConfig is missing some properties', async (): Promise<void> => {

      const faultyProcessInstanceConfig = clone(sampleProcessInstanceConfig);

      delete faultyProcessInstanceConfig.correlationId;
      delete faultyProcessInstanceConfig.processModelId;
      delete faultyProcessInstanceConfig.processInstanceId;

      try {
        const processInstanceStateHandlingFacade = fixtureProvider.createProcessInstanceStateHandlingFacade();
        await processInstanceStateHandlingFacade.saveProcessInstance(sampleIdentity, sampleProcessInstanceConfig);
      } catch (error) {
        should.fail('received result', undefined, 'Did not expect an error here!');
      }
    });

  });
});
