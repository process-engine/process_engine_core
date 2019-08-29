import * as moment from 'moment';
import * as should from 'should';

import {IIdentity} from '@essential-projects/iam_contracts';
import {Correlation, CorrelationState} from '@process-engine/correlation.contracts';

import {CorrelationServiceMock, EventAggregatorMock} from '../mocks';
import {TestFixtureProvider} from '../test_fixture_provider';

describe('ProcessInstanceStateHandlingFacade.terminateSubprocesses', (): void => {

  let fixtureProvider: TestFixtureProvider;

  const sampleIdentity = {
    userId: 'userId',
    token: 'dsöfhpadfsghösjbgsöjghbdlögdfg',
  };

  before(async (): Promise<void> => {
    fixtureProvider = new TestFixtureProvider();
    await fixtureProvider.initialize();
  });

  describe('Execution', (): void => {

    it('Should send a termination signal to every found subprocess', async (): Promise<void> => {

      let subProcessesTerminated = 0;

      const sampleCorrelation: Correlation = {
        id: 'sdfasdfdsf',
        state: CorrelationState.running,
        error: undefined,
        createdAt: moment().toDate(),
        processInstances: [{
          processDefinitionName: 'processDefName',
          hash: 'sfhasfghsjghsdfgfdsg',
          xml: '<>',
          processModelId: 'processModelId',
          processInstanceId: 'processInstanceId',
          parentProcessInstanceId: 'parent',
          state: CorrelationState.running,
          error: undefined,
          identity: {userId: 'hello', token: 'sdfsdfsdsf'},
        }],
      };

      const correlationServiceMock = new CorrelationServiceMock();
      correlationServiceMock.getSubprocessesForProcessInstance =
        (identity: IIdentity, processInstanceId: string): Promise<any> => {
          return Promise.resolve(sampleCorrelation);
        };

      const eventAggregatorMock = new EventAggregatorMock();
      eventAggregatorMock.publish = (): void => {
        subProcessesTerminated++;
      };

      const processInstanceStateHandlingFacade =
        fixtureProvider.createProcessInstanceStateHandlingFacade(correlationServiceMock, eventAggregatorMock);

      await processInstanceStateHandlingFacade.terminateSubprocesses(sampleIdentity, 'processInstanceId');

      should(subProcessesTerminated).be.equal(1);
    });

    it('Should not send a termination signal to subprocesses that are already finished', async (): Promise<void> => {

      let subProcessesTerminated = 0;

      const sampleCorrelation: Correlation = {
        id: 'sdfasdfdsf',
        state: CorrelationState.running,
        error: undefined,
        createdAt: moment().toDate(),
        processInstances: [{
          processDefinitionName: 'processDefName',
          hash: 'sfhasfghsjghsdfgfdsg',
          xml: '<>',
          processModelId: 'processModelId',
          processInstanceId: 'processInstanceId',
          parentProcessInstanceId: 'parent',
          state: CorrelationState.running,
          error: undefined,
          identity: {userId: 'hello', token: 'sdfsdfsdsf'},
        }, {
          processDefinitionName: 'processDefName2',
          hash: 'sfhasfghsjghsdfgfdsg123123',
          xml: '<>',
          processModelId: 'processModelId2',
          processInstanceId: 'processInstanceId222',
          parentProcessInstanceId: 'parent',
          state: CorrelationState.finished,
          error: undefined,
          identity: {userId: 'hello', token: 'sdfsdfsdsf'},
        }],
      };

      const correlationServiceMock = new CorrelationServiceMock();
      correlationServiceMock.getSubprocessesForProcessInstance =
        (identity: IIdentity, processInstanceId: string): Promise<any> => {
          return Promise.resolve(sampleCorrelation);
        };

      const eventAggregatorMock = new EventAggregatorMock();
      eventAggregatorMock.publish = (): void => {
        subProcessesTerminated++;
      };

      const processInstanceStateHandlingFacade =
        fixtureProvider.createProcessInstanceStateHandlingFacade(correlationServiceMock, eventAggregatorMock);

      await processInstanceStateHandlingFacade.terminateSubprocesses(sampleIdentity, 'processInstanceId');

      should(subProcessesTerminated).be.equal(1);
    });

    it('Should not send a termination signal to subprocesses that are already finished with an error', async (): Promise<void> => {

      let subProcessesTerminated = 0;

      const sampleCorrelation: Correlation = {
        id: 'sdfasdfdsf',
        state: CorrelationState.running,
        error: undefined,
        createdAt: moment().toDate(),
        processInstances: [{
          processDefinitionName: 'processDefName',
          hash: 'sfhasfghsjghsdfgfdsg',
          xml: '<>',
          processModelId: 'processModelId',
          processInstanceId: 'processInstanceId',
          parentProcessInstanceId: 'parent',
          state: CorrelationState.running,
          error: undefined,
          identity: {userId: 'hello', token: 'sdfsdfsdsf'},
        }, {
          processDefinitionName: 'processDefName2',
          hash: 'sfhasfghsjghsdfgfdsg123123',
          xml: '<>',
          processModelId: 'processModelId2',
          processInstanceId: 'processInstanceId222',
          parentProcessInstanceId: 'parent',
          state: CorrelationState.error,
          error: undefined,
          identity: {userId: 'hello', token: 'sdfsdfsdsf'},
        }],
      };

      const correlationServiceMock = new CorrelationServiceMock();
      correlationServiceMock.getSubprocessesForProcessInstance =
        (identity: IIdentity, processInstanceId: string): Promise<any> => {
          return Promise.resolve(sampleCorrelation);
        };

      const eventAggregatorMock = new EventAggregatorMock();
      eventAggregatorMock.publish = (): void => {
        subProcessesTerminated++;
      };

      const processInstanceStateHandlingFacade =
        fixtureProvider.createProcessInstanceStateHandlingFacade(correlationServiceMock, eventAggregatorMock);

      await processInstanceStateHandlingFacade.terminateSubprocesses(sampleIdentity, 'processInstanceId');

      should(subProcessesTerminated).be.equal(1);
    });
  });

  describe('Sanity Checks', (): void => {

    it('Should throw an error, if no processInstanceId is passed', async (): Promise<void> => {
      try {
        const processInstanceStateHandlingFacade = fixtureProvider.createProcessInstanceStateHandlingFacade();
        await processInstanceStateHandlingFacade.terminateSubprocesses(sampleIdentity, undefined);
        should.fail('received result', undefined, 'Expected this test to cause an error!');
      } catch (error) {
        should(error).be.instanceOf(Error);
      }
    });

    it('Should not throw an error, if no Identity is given', async (): Promise<void> => {
      try {
        const processInstanceStateHandlingFacade = fixtureProvider.createProcessInstanceStateHandlingFacade();
        await processInstanceStateHandlingFacade.terminateSubprocesses(undefined, 'sampleProcessInstanceId');
      } catch (error) {
        should.fail('received result', undefined, 'Did not expect an error here!');
      }
    });

    it('Should not be doing anything, if no correlation is returned by the CorrelationService', async (): Promise<void> => {

      let subProcessesTerminated = 0;

      const correlationServiceMock = new CorrelationServiceMock();
      correlationServiceMock.getSubprocessesForProcessInstance =
        (identity: IIdentity, processInstanceId: string): Promise<any> => {
          return Promise.resolve(undefined);
        };

      const eventAggregatorMock = new EventAggregatorMock();
      eventAggregatorMock.publish = (): void => {
        subProcessesTerminated++;
      };

      const processInstanceStateHandlingFacade =
        fixtureProvider.createProcessInstanceStateHandlingFacade(correlationServiceMock, eventAggregatorMock);

      await processInstanceStateHandlingFacade.terminateSubprocesses(sampleIdentity, 'processInstanceId');

      should(subProcessesTerminated).be.equal(0);
    });

    it('Should not be doing anything, if the correlation returned by the CorrelationService has no entries', async (): Promise<void> => {

      let subProcessesTerminated = 0;

      const sampleCorrelation: Correlation = {
        id: 'sdfasdfdsf',
        state: CorrelationState.running,
        error: undefined,
        createdAt: moment().toDate(),
        processInstances: [],
      };

      const correlationServiceMock = new CorrelationServiceMock();
      correlationServiceMock.getSubprocessesForProcessInstance =
        (identity: IIdentity, processInstanceId: string): Promise<any> => {
          return Promise.resolve(sampleCorrelation);
        };

      const eventAggregatorMock = new EventAggregatorMock();
      eventAggregatorMock.publish = (): void => {
        subProcessesTerminated++;
      };

      const processInstanceStateHandlingFacade =
        fixtureProvider.createProcessInstanceStateHandlingFacade(correlationServiceMock, eventAggregatorMock);

      await processInstanceStateHandlingFacade.terminateSubprocesses(sampleIdentity, 'processInstanceId');

      should(subProcessesTerminated).be.equal(0);
    });
  });
});
