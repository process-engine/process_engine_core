import * as should from 'should';

import {BpmnType, Model} from '@process-engine/persistence_api.contracts';

import {TimerFacade} from '../../../src/runtime/facades/timer_facade';
import {TestFixtureProvider} from '../../test_fixture_provider';

describe('TimerFacade.initializeTimer', (): void => {

  let fixtureProvider: TestFixtureProvider;

  const sampleFlowNode = {
    id: 'hellohello',
    bpmnType: BpmnType.startEvent,
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

  const sampleCallback = (payload: any): any => {
    return 'samplePayload';
  };

  before(async (): Promise<void> => {
    fixtureProvider = new TestFixtureProvider();
    await fixtureProvider.initialize();
  });

  describe('Execution', (): void => {

    it('Should successfully initialize a cyclic timer', (): void => {

      const sampleTimerDefinition = new Model.Events.Definitions.TimerEventDefinition();
      sampleTimerDefinition.timerType = Model.Events.Definitions.TimerType.timeCycle;
      sampleTimerDefinition.value = '*/2 * * * * *';

      let receivedTimerValue: string;
      let receivedCallback: Function;
      let receivedEventName: string;

      const timerFacade = fixtureProvider.createTimerFacade();
      timerFacade.startCycleTimer =
        (timerValue: string, flowNode: Model.Base.FlowNode, timerCallback: Function, timerExpiredEventName: string): any => {
          receivedTimerValue = timerValue;
          receivedCallback = timerCallback;
          receivedEventName = timerExpiredEventName;
        };

      timerFacade.initializeTimer(sampleFlowNode as any, sampleTimerDefinition, processTokenFacadeMock as any, sampleCallback);

      should(receivedTimerValue).be.eql(sampleTimerDefinition.value);
      should(receivedCallback).be.eql(sampleCallback);
      should(receivedEventName).containEql(sampleFlowNode.id);
    });

    it('Should successfully initialize a date timer', (): void => {

      const sampleTimerDefinition = new Model.Events.Definitions.TimerEventDefinition();
      sampleTimerDefinition.timerType = Model.Events.Definitions.TimerType.timeDate;
      sampleTimerDefinition.value = '2019-08-30T11:30:00.000Z';

      let receivedTimerValue: string;
      let receivedCallback: Function;
      let receivedEventName: string;

      const timerFacade = fixtureProvider.createTimerFacade();
      timerFacade.startDateTimer = (timerValue: string, timerCallback: Function, timerExpiredEventName: string): any => {
        receivedTimerValue = timerValue;
        receivedCallback = timerCallback;
        receivedEventName = timerExpiredEventName;
      };

      timerFacade.initializeTimer(sampleFlowNode as any, sampleTimerDefinition, processTokenFacadeMock as any, sampleCallback);

      should(receivedTimerValue).be.eql(sampleTimerDefinition.value);
      should(receivedCallback).be.eql(sampleCallback);
      should(receivedEventName).containEql(sampleFlowNode.id);
    });

    it('Should successfully initialize a duration timer', (): void => {

      const sampleTimerDefinition = new Model.Events.Definitions.TimerEventDefinition();
      sampleTimerDefinition.timerType = Model.Events.Definitions.TimerType.timeDuration;
      sampleTimerDefinition.value = 'P0Y0M0DT0H0M2S';

      let receivedTimerValue: string;
      let receivedCallback: Function;
      let receivedEventName: string;

      const timerFacade = fixtureProvider.createTimerFacade();
      timerFacade.startDurationTimer = (timerValue: string, timerCallback: Function, timerExpiredEventName: string): any => {
        receivedTimerValue = timerValue;
        receivedCallback = timerCallback;
        receivedEventName = timerExpiredEventName;
      };

      timerFacade.initializeTimer(sampleFlowNode as any, sampleTimerDefinition, processTokenFacadeMock as any, sampleCallback);

      should(receivedTimerValue).be.eql(sampleTimerDefinition.value);
      should(receivedCallback).be.eql(sampleCallback);
      should(receivedEventName).containEql(sampleFlowNode.id);
    });
  });

  describe('Sanity Checks', (): void => {

    let timerFacade: TimerFacade;

    before((): void => {
      timerFacade = fixtureProvider.createTimerFacade();
    });

    it('Should throw an error, if no FlowNode is provided with a cyclic timer', (): void => {

      try {
        const sampleTimerDefinition = new Model.Events.Definitions.TimerEventDefinition();
        sampleTimerDefinition.timerType = Model.Events.Definitions.TimerType.timeCycle;
        sampleTimerDefinition.value = '*/2 * * * * *';

        timerFacade.initializeTimer(undefined, sampleTimerDefinition, processTokenFacadeMock as any, sampleCallback);
      } catch (error) {
        should(error).be.instanceOf(Error);
      }
    });

    it('Should throw an error, if no FlowNode is provided with a date timer', (): void => {

      try {
        const sampleTimerDefinition = new Model.Events.Definitions.TimerEventDefinition();
        sampleTimerDefinition.timerType = Model.Events.Definitions.TimerType.timeDate;
        sampleTimerDefinition.value = '2019-08-30T11:30:00.000Z';

        timerFacade.initializeTimer(undefined, sampleTimerDefinition, processTokenFacadeMock as any, sampleCallback);
      } catch (error) {
        should(error).be.instanceOf(Error);
      }
    });

    it('Should throw an error, if no FlowNode is provided with a duration timer', (): void => {

      try {
        const sampleTimerDefinition = new Model.Events.Definitions.TimerEventDefinition();
        sampleTimerDefinition.timerType = Model.Events.Definitions.TimerType.timeDuration;
        sampleTimerDefinition.value = 'P0Y0M0DT0H0M2S';

        timerFacade.initializeTimer(undefined, sampleTimerDefinition, processTokenFacadeMock as any, sampleCallback);
      } catch (error) {
        should(error).be.instanceOf(Error);
      }
    });

    it('Should throw an error, if the timer definition contains an invalid type', (): void => {

      try {
        const sampleTimerDefinition = new Model.Events.Definitions.TimerEventDefinition();
        sampleTimerDefinition.timerType = 'somethingInvalid' as any;
        sampleTimerDefinition.value = 'P0Y0M0DT0H0M2S';

        timerFacade.initializeTimer(sampleFlowNode as any, sampleTimerDefinition, processTokenFacadeMock as any, sampleCallback);
      } catch (error) {
        should(error).be.instanceOf(Error);
      }
    });

    it('Should throw an error, if the timer definition contains an invalid value', (): void => {

      try {
        const sampleTimerDefinition = new Model.Events.Definitions.TimerEventDefinition();
        sampleTimerDefinition.timerType = Model.Events.Definitions.TimerType.timeDuration;
        sampleTimerDefinition.value = 'sfasfadsfdsfasdfadsf';

        timerFacade.initializeTimer(sampleFlowNode as any, sampleTimerDefinition, processTokenFacadeMock as any, sampleCallback);
      } catch (error) {
        should(error).be.instanceOf(Error);
      }
    });

    it('Should throw an error, if no callback is provided', (): void => {

      try {
        const sampleTimerDefinition = new Model.Events.Definitions.TimerEventDefinition();
        sampleTimerDefinition.timerType = Model.Events.Definitions.TimerType.timeDate;
        sampleTimerDefinition.value = '2019-08-30T11:30:00.000Z';

        timerFacade.initializeTimer(sampleFlowNode as any, sampleTimerDefinition, processTokenFacadeMock as any, sampleCallback);
      } catch (error) {
        should(error).be.instanceOf(Error);
      }
    });
  });
});
