import * as should from 'should';

import {TimerDefinitionType} from '@process-engine/process_engine_contracts';

import {TimerFacade} from '../../src/runtime/facades/timer_facade';
import {TestFixtureProvider} from '../test_fixture_provider';

// NOTE: This UseCase will be made obsolete in the near future.
describe('TimerFacade.initializeTimerFromDefinition', (): void => {

  let fixtureProvider: TestFixtureProvider;

  const sampleFlowNode = {
    id: 'hellohello',
  };

  const sampleCallback = (payload: any): any => {
    return 'samplePayload';
  };

  const processTokenFacadeMock = {
    getOldTokenFormat: (): any => {
      return {
        current: 'hello',
        history: {
          FlowNode1: 'hello',
          FlowNode2: {
            someValue: 'world',
          },
        },
      };
    },
  };

  before(async (): Promise<void> => {
    fixtureProvider = new TestFixtureProvider();
    await fixtureProvider.initialize();
  });

  describe('Execution', (): void => {

    it('Should successfully initialize a cyclic timer', (): void => {

      // NOTE: This is how this definition actually looks like after it was parsed.
      // See TODO in /src/model/parser/flow_node_parsers/event_parser.ts Line 223.
      const sampleDefinition = {
        'bpmn:timeCycle': {
          _: '*/2 * * * * *',
        },
        enabled: true,
      };

      let receivedFlowNode: any;
      let receviedTimerType: TimerDefinitionType;
      let receivedTimerValue: string;
      let receivedCallback: Function;

      const timerFacade = fixtureProvider.createTimerFacade();
      timerFacade.initializeTimer = (flowNode: any, timerType: TimerDefinitionType, timerValue: string, callback: Function): any => {
        receivedFlowNode = flowNode;
        receviedTimerType = timerType;
        receivedTimerValue = timerValue;
        receivedCallback = callback;
      };

      timerFacade.initializeTimerFromDefinition(sampleFlowNode as any, sampleDefinition as any, processTokenFacadeMock as any, sampleCallback);

      should(receivedFlowNode).be.eql(sampleFlowNode);
      should(receviedTimerType).be.eql(TimerDefinitionType.cycle);
      should(receivedTimerValue).be.eql('*/2 * * * * *');
      should(receivedCallback).be.eql(sampleCallback);
    });

    it('Should successfully initialize a date timer', (): void => {

      const sampleDefinition = {
        'bpmn:timeDate': {
          _: '2019-08-30T11:30:00.000Z',
        },
        enabled: true,
      };

      let receivedFlowNode: any;
      let receviedTimerType: TimerDefinitionType;
      let receivedTimerValue: string;
      let receivedCallback: Function;

      const timerFacade = fixtureProvider.createTimerFacade();
      timerFacade.initializeTimer = (flowNode: any, timerType: TimerDefinitionType, timerValue: string, callback: Function): any => {
        receivedFlowNode = flowNode;
        receviedTimerType = timerType;
        receivedTimerValue = timerValue;
        receivedCallback = callback;
      };

      timerFacade.initializeTimerFromDefinition(sampleFlowNode as any, sampleDefinition as any, processTokenFacadeMock as any, sampleCallback);

      should(receivedFlowNode).be.eql(sampleFlowNode);
      should(receviedTimerType).be.eql(TimerDefinitionType.date);
      should(receivedTimerValue).be.eql('2019-08-30T11:30:00.000Z');
      should(receivedCallback).be.eql(sampleCallback);

    });

    it('Should successfully initialize a duration timer', (): void => {

      const sampleDefinition = {
        'bpmn:timeDuration': {
          _: 'P0Y0M0DT0H0M2S',
        },
        enabled: true,
      };

      let receivedFlowNode: any;
      let receviedTimerType: TimerDefinitionType;
      let receivedTimerValue: string;
      let receivedCallback: Function;

      const timerFacade = fixtureProvider.createTimerFacade();
      timerFacade.initializeTimer = (flowNode: any, timerType: TimerDefinitionType, timerValue: string, callback: Function): any => {
        receivedFlowNode = flowNode;
        receviedTimerType = timerType;
        receivedTimerValue = timerValue;
        receivedCallback = callback;
      };

      timerFacade.initializeTimerFromDefinition(sampleFlowNode as any, sampleDefinition as any, processTokenFacadeMock as any, sampleCallback);

      should(receivedFlowNode).be.eql(sampleFlowNode);
      should(receviedTimerType).be.eql(TimerDefinitionType.duration);
      should(receivedTimerValue).be.eql('P0Y0M0DT0H0M2S');
      should(receivedCallback).be.eql(sampleCallback);
    });
  });

  describe('Sanity Checks', (): void => {

    let timerFacade: TimerFacade;

    before((): void => {
      timerFacade = fixtureProvider.createTimerFacade();
    });

    it('Should throw an error, if no FlowNode is provided with a cyclic timer', (): void => {

      try {
        const sampleDefinition = {
          'bpmn:timeCycle': {
            _: '*/2 * * * * *',
          },
          enabled: true,
        };

        timerFacade.initializeTimerFromDefinition(undefined, sampleDefinition as any, processTokenFacadeMock as any, sampleCallback);
      } catch (error) {
        should(error).be.instanceOf(Error);
      }
    });

    it('Should throw an error, if no FlowNode is provided with a date timer', (): void => {

      try {
        const sampleDefinition = {
          'bpmn:timeDate': {
            _: '2019-08-30T11:30:00.000Z',
          },
          enabled: true,
        };

        timerFacade.initializeTimerFromDefinition(undefined, sampleDefinition as any, processTokenFacadeMock as any, sampleCallback);
      } catch (error) {
        should(error).be.instanceOf(Error);
      }
    });

    it('Should throw an error, if no FlowNode is provided with a duration timer', (): void => {

      try {
        const sampleDefinition = {
          'bpmn:timeDuration': {
            _: 'P0Y0M0DT0H0M2S',
          },
          enabled: true,
        };

        timerFacade.initializeTimerFromDefinition(undefined, sampleDefinition as any, processTokenFacadeMock as any, sampleCallback);
      } catch (error) {
        should(error).be.instanceOf(Error);
      }
    });

    it('Should throw an error, if the timer definition contains an invalid type', (): void => {

      try {
        const sampleDefinition = {
          'bpmn:timeInvalid': {
            _: 'qsdfsaddsf',
          },
          enabled: true,
        };

        timerFacade.initializeTimerFromDefinition(sampleFlowNode as any, sampleDefinition as any, processTokenFacadeMock as any, sampleCallback);
      } catch (error) {
        should(error).be.instanceOf(Error);
      }
    });

    it('Should throw an error, if the timer definition contains an invalid value', (): void => {

      try {
        const sampleDefinition = {
          'bpmn:timeCycle': {
            _: 'qsdfsaddsf',
          },
          enabled: true,
        };

        timerFacade.initializeTimerFromDefinition(sampleFlowNode as any, sampleDefinition as any, processTokenFacadeMock as any, sampleCallback);
      } catch (error) {
        should(error).be.instanceOf(Error);
      }
    });

    it('Should throw an error, if no callback is provided', (): void => {

      try {
        const sampleDefinition = {
          'bpmn:timeCycle': {
            _: '*/2 * * * * *',
          },
          enabled: true,
        };

        timerFacade.initializeTimerFromDefinition(sampleFlowNode as any, sampleDefinition as any, processTokenFacadeMock as any, undefined);
      } catch (error) {
        should(error).be.instanceOf(Error);
      }
    });
  });
});
