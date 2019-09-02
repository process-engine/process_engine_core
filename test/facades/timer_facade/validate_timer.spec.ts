import * as should from 'should';

import {BpmnType, TimerDefinitionType} from '@process-engine/process_engine_contracts';
import {UnprocessableEntityError} from '@essential-projects/errors_ts';

import {TimerFacade} from '../../../src/runtime/facades/timer_facade';
import {TestFixtureProvider} from '../test_fixture_provider';

describe('TimerFacade.validateTimer', (): void => {

  let fixtureProvider: TestFixtureProvider;
  let timerFacade: TimerFacade;

  before(async (): Promise<void> => {
    fixtureProvider = new TestFixtureProvider();
    await fixtureProvider.initialize();

    timerFacade = await fixtureProvider.createTimerFacade();
  });

  describe('Cyclic Timers', (): void => {

    it('Should successfully validate the given valid cyclic timer on a StartEvent.', (): void => {

      const timerType = TimerDefinitionType.cycle;
      const timerValue = '* 5 * * * *';

      const sampleFlowNode = {
        bpmnType: BpmnType.startEvent,
      };

      timerFacade.validateTimer(sampleFlowNode as any, timerType, timerValue);
    });

    it('Should throw an error for an invalid cyclic timer value on a StartEvent.', (): void => {

      try {
        const timerType = TimerDefinitionType.cycle;
        const timerValue = 'asdf';

        const sampleFlowNode = {
          bpmnType: BpmnType.startEvent,
        };

        timerFacade.validateTimer(sampleFlowNode as any, timerType, timerValue);
      } catch (error) {
        should(error).be.instanceOf(UnprocessableEntityError);
        should(error.message).be.match(/not a valid crontab/i);
      }
    });

    it('Should throw an error for a valid cyclic timer on an IntermediateTimerEvent.', (): void => {

      try {
        const timerType = TimerDefinitionType.cycle;
        const timerValue = '* 5 * * * *';

        const sampleFlowNode = {
          bpmnType: BpmnType.intermediateCatchEvent,
        };

        timerFacade.validateTimer(sampleFlowNode as any, timerType, timerValue);
      } catch (error) {
        should(error).be.instanceOf(UnprocessableEntityError);
        should(error.message).be.match(/only allowed for TimerStartEvents/i);
      }
    });

    it('Should throw an error for a valid cyclic timer on a BoundaryEvent.', (): void => {

      try {
        const timerType = TimerDefinitionType.cycle;
        const timerValue = '* 5 * * * *';

        const sampleFlowNode = {
          bpmnType: BpmnType.boundaryEvent,
        };

        timerFacade.validateTimer(sampleFlowNode as any, timerType, timerValue);
      } catch (error) {
        should(error).be.instanceOf(UnprocessableEntityError);
        should(error.message).be.match(/only allowed for TimerStartEvents/i);
      }
    });

    it('Should throw an error for a malformed crontab.', (): void => {

      try {
        const timerType = TimerDefinitionType.cycle;
        const timerValue = '* * * 1';

        const sampleFlowNode = {
          bpmnType: BpmnType.startEvent,
        };

        timerFacade.validateTimer(sampleFlowNode as any, timerType, timerValue);
      } catch (error) {
        should(error).be.instanceOf(UnprocessableEntityError);
        should(error.message).be.match(/not a valid crontab/i);
      }
    });

    it('Should throw an error when providing a date value.', (): void => {

      try {
        const timerType = TimerDefinitionType.cycle;
        const timerValue = '2022-08-30T11:33:33.000Z';

        const sampleFlowNode = {
          bpmnType: BpmnType.startEvent,
        };

        timerFacade.validateTimer(sampleFlowNode as any, timerType, timerValue);
      } catch (error) {
        should(error).be.instanceOf(UnprocessableEntityError);
        should(error.message).be.match(/not a valid crontab/i);
      }
    });

    it('Should throw an error when providing a duration.', (): void => {

      try {
        const timerType = TimerDefinitionType.cycle;
        const timerValue = 'P0Y0M0DT0H0M2S';

        const sampleFlowNode = {
          bpmnType: BpmnType.startEvent,
        };

        timerFacade.validateTimer(sampleFlowNode as any, timerType, timerValue);
      } catch (error) {
        should(error).be.instanceOf(UnprocessableEntityError);
        should(error.message).be.match(/not a valid crontab/i);
      }
    });
  });

  describe('Date Timers', (): void => {

    it('Should successfully validate the given valid date timer, regardless of the supplied FlowNode.', (): void => {

      const timerType = TimerDefinitionType.date;
      const timerValue = '2019-08-30T11:30:00.000Z';

      const sampleFlowNode = {};

      timerFacade.validateTimer(sampleFlowNode as any, timerType, timerValue);
    });

    it('Should throw an error, when providing a crontab.', (): void => {

      try {
        const timerType = TimerDefinitionType.date;
        const timerValue = '* 5 * * * *';

        const sampleFlowNode = {};

        timerFacade.validateTimer(sampleFlowNode as any, timerType, timerValue);
      } catch (error) {
        should(error).be.instanceOf(UnprocessableEntityError);
        should(error.message).be.match(/not in ISO8601 format/i);
      }
    });

    it('Should throw an error, when providing a duration.', (): void => {

      try {
        const timerType = TimerDefinitionType.date;
        const timerValue = 'P0Y0M0DT0H0M2S';

        const sampleFlowNode = {};

        timerFacade.validateTimer(sampleFlowNode as any, timerType, timerValue);
      } catch (error) {
        should(error).be.instanceOf(UnprocessableEntityError);
        should(error.message).be.match(/not in ISO8601 format/i);
      }
    });

    it('Should throw an error, when providing a completely invalid value.', (): void => {

      try {
        const timerType = TimerDefinitionType.date;
        const timerValue = 'asdf';

        const sampleFlowNode = {};

        timerFacade.validateTimer(sampleFlowNode as any, timerType, timerValue);
      } catch (error) {
        should(error).be.instanceOf(UnprocessableEntityError);
        should(error.message).be.match(/not in ISO8601 format/i);
      }
    });
  });

  describe('Duration Timers', (): void => {

    it('Should successfully validate the given valid duration timer, regardless of the supplied FlowNode.', (): void => {

      const timerType = TimerDefinitionType.duration;
      const timerValue = 'P0Y0M0DT0H0M2S';

      const sampleFlowNode = {};

      timerFacade.validateTimer(sampleFlowNode as any, timerType, timerValue);
    });

    it('Should throw an error, when providing a crontab.', (): void => {

      try {
        const timerType = TimerDefinitionType.duration;
        const timerValue = '* 5 * * * *';

        const sampleFlowNode = {};

        timerFacade.validateTimer(sampleFlowNode as any, timerType, timerValue);
      } catch (error) {
        should(error).be.instanceOf(UnprocessableEntityError);
        should(error.message).be.match(/not in ISO8601 format/i);
      }
    });

    it('Should throw an error, when providing a date.', (): void => {

      try {
        const timerType = TimerDefinitionType.duration;
        const timerValue = '2019-08-30T11:30:00.000Z';

        const sampleFlowNode = {};

        timerFacade.validateTimer(sampleFlowNode as any, timerType, timerValue);
      } catch (error) {
        should(error).be.instanceOf(UnprocessableEntityError);
        should(error.message).be.match(/not in ISO8601 format/i);
      }
    });

    it('Should throw an error, when providing a completely invalid value.', (): void => {

      try {
        const timerType = TimerDefinitionType.duration;
        const timerValue = 'asdf';

        const sampleFlowNode = {};

        timerFacade.validateTimer(sampleFlowNode as any, timerType, timerValue);
      } catch (error) {
        should(error).be.instanceOf(UnprocessableEntityError);
        should(error.message).be.match(/not in ISO8601 format/i);
      }
    });

  });

  describe('Sanity Checks', (): void => {

    it('Should succeed, when not providing a FlowNode to a date check.', (): void => {

      const timerType = TimerDefinitionType.date;
      const timerValue = '2019-08-30T11:30:00.000Z';

      timerFacade.validateTimer(undefined, timerType, timerValue);
    });

    it('Should succeed, when not providing a FlowNode to a duration check.', (): void => {

      const timerType = TimerDefinitionType.duration;
      const timerValue = 'P0Y0M0DT0H0M2S';

      timerFacade.validateTimer(undefined, timerType, timerValue);
    });

    it('Should throw an error, when not providing a FlowNode with a cyclic timer check.', (): void => {

      try {
        const timerType = TimerDefinitionType.cycle;
        const timerValue = '* 5 * * * *';

        timerFacade.validateTimer(undefined, timerType, timerValue);
      } catch (error) {
        should(error).be.instanceOf(Error);
      }
    });

    it('Should throw an error, when providing no value to a cyclic timer check.', (): void => {

      try {
        const timerType = TimerDefinitionType.cycle;

        const sampleFlowNode = {
          bpmnType: BpmnType.startEvent,
        };

        timerFacade.validateTimer(sampleFlowNode as any, timerType, undefined);
      } catch (error) {
        should(error).be.instanceOf(UnprocessableEntityError);
        should(error.message).be.match(/not a valid crontab/i);
      }
    });

    it('Should throw an error, when providing no value to a date timer check.', (): void => {

      try {
        const timerType = TimerDefinitionType.date;

        const sampleFlowNode = {};

        timerFacade.validateTimer(sampleFlowNode as any, timerType, undefined);
      } catch (error) {
        should(error).be.instanceOf(UnprocessableEntityError);
        should(error.message).be.match(/not in ISO8601 format/i);
      }
    });

    it('Should throw an error, when providing no value to a duration timer check.', (): void => {

      try {
        const timerType = TimerDefinitionType.duration;

        const sampleFlowNode = {};

        timerFacade.validateTimer(sampleFlowNode as any, timerType, undefined);
      } catch (error) {
        should(error).be.instanceOf(UnprocessableEntityError);
        should(error.message).be.match(/not in ISO8601 format/i);
      }
    });

    it('Should throw an error, when not providing a Timer Type for any check.', (): void => {

      try {
        const sampleFlowNode = {};

        timerFacade.validateTimer(sampleFlowNode as any, undefined, '* * * * 1');
      } catch (error) {
        should(error).be.instanceOf(UnprocessableEntityError);
        should(error.message).be.match(/unknown timer definition type/i);
      }
    });
  });
});
