import * as should from 'should';

import {BpmnType, Model} from '@process-engine/persistence_api.contracts';
import {UnprocessableEntityError} from '@essential-projects/errors_ts';

import {TimerFacade} from '../../../src/runtime/facades/timer_facade';
import {TestFixtureProvider} from '../../test_fixture_provider';

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

      const sampleTimerDefinition = new Model.Events.Definitions.TimerEventDefinition();
      sampleTimerDefinition.timerType = Model.Events.Definitions.TimerType.timeCycle;
      sampleTimerDefinition.value = '* 5 * * * *';

      const sampleFlowNode = {
        bpmnType: BpmnType.startEvent,
      };

      timerFacade.validateTimer(sampleTimerDefinition, sampleFlowNode as any);
    });

    it('Should throw an error for an invalid cyclic timer value on a StartEvent.', (): void => {

      try {
        const sampleTimerDefinition = new Model.Events.Definitions.TimerEventDefinition();
        sampleTimerDefinition.timerType = Model.Events.Definitions.TimerType.timeCycle;
        sampleTimerDefinition.value = 'asdf';

        const sampleFlowNode = {
          bpmnType: BpmnType.startEvent,
        };

        timerFacade.validateTimer(sampleTimerDefinition, sampleFlowNode as any);
      } catch (error) {
        should(error).be.instanceOf(UnprocessableEntityError);
        should(error.message).be.match(/not a valid crontab/i);
      }
    });

    it('Should throw an error for a valid cyclic timer on an IntermediateTimerEvent.', (): void => {

      try {
        const sampleTimerDefinition = new Model.Events.Definitions.TimerEventDefinition();
        sampleTimerDefinition.timerType = Model.Events.Definitions.TimerType.timeCycle;
        sampleTimerDefinition.value = '* 5 * * * *';

        const sampleFlowNode = {
          bpmnType: BpmnType.intermediateCatchEvent,
        };

        timerFacade.validateTimer(sampleTimerDefinition, sampleFlowNode as any);
      } catch (error) {
        should(error).be.instanceOf(UnprocessableEntityError);
        should(error.message).be.match(/only allowed for TimerStartEvents/i);
      }
    });

    it('Should throw an error for a valid cyclic timer on a BoundaryEvent.', (): void => {

      try {
        const sampleTimerDefinition = new Model.Events.Definitions.TimerEventDefinition();
        sampleTimerDefinition.timerType = Model.Events.Definitions.TimerType.timeCycle;
        sampleTimerDefinition.value = '* 5 * * * *';

        const sampleFlowNode = {
          bpmnType: BpmnType.boundaryEvent,
        };

        timerFacade.validateTimer(sampleTimerDefinition, sampleFlowNode as any);
      } catch (error) {
        should(error).be.instanceOf(UnprocessableEntityError);
        should(error.message).be.match(/only allowed for TimerStartEvents/i);
      }
    });

    it('Should throw an error for a malformed crontab.', (): void => {

      try {
        const sampleTimerDefinition = new Model.Events.Definitions.TimerEventDefinition();
        sampleTimerDefinition.timerType = Model.Events.Definitions.TimerType.timeCycle;
        sampleTimerDefinition.value = '* 5 * * *';

        const sampleFlowNode = {
          bpmnType: BpmnType.startEvent,
        };

        timerFacade.validateTimer(sampleTimerDefinition, sampleFlowNode as any);
      } catch (error) {
        should(error).be.instanceOf(UnprocessableEntityError);
        should(error.message).be.match(/not a valid crontab/i);
      }
    });

    it('Should throw an error when providing a date value.', (): void => {

      try {
        const sampleTimerDefinition = new Model.Events.Definitions.TimerEventDefinition();
        sampleTimerDefinition.timerType = Model.Events.Definitions.TimerType.timeCycle;
        sampleTimerDefinition.value = '2022-08-30T11:33:33.000Z';

        const sampleFlowNode = {
          bpmnType: BpmnType.startEvent,
        };

        timerFacade.validateTimer(sampleTimerDefinition, sampleFlowNode as any);
      } catch (error) {
        should(error).be.instanceOf(UnprocessableEntityError);
        should(error.message).be.match(/not a valid crontab/i);
      }
    });

    it('Should throw an error when providing a duration.', (): void => {

      try {
        const sampleTimerDefinition = new Model.Events.Definitions.TimerEventDefinition();
        sampleTimerDefinition.timerType = Model.Events.Definitions.TimerType.timeCycle;
        sampleTimerDefinition.value = 'P0Y0M0DT0H0M2S';

        const sampleFlowNode = {
          bpmnType: BpmnType.startEvent,
        };

        timerFacade.validateTimer(sampleTimerDefinition, sampleFlowNode as any);
      } catch (error) {
        should(error).be.instanceOf(UnprocessableEntityError);
        should(error.message).be.match(/not a valid crontab/i);
      }
    });
  });

  describe('Date Timers', (): void => {

    it('Should successfully validate the given valid date timer, regardless of the supplied FlowNode.', (): void => {

      const sampleTimerDefinition = new Model.Events.Definitions.TimerEventDefinition();
      sampleTimerDefinition.timerType = Model.Events.Definitions.TimerType.timeDate;
      sampleTimerDefinition.value = '2019-08-30T11:30:00.000Z';

      const sampleFlowNode = {};

      timerFacade.validateTimer(sampleTimerDefinition, sampleFlowNode as any);
    });

    it('Should throw an error, when providing a crontab.', (): void => {

      try {
        const sampleTimerDefinition = new Model.Events.Definitions.TimerEventDefinition();
        sampleTimerDefinition.timerType = Model.Events.Definitions.TimerType.timeDate;
        sampleTimerDefinition.value = '* 5 * * * *';

        const sampleFlowNode = {};

        timerFacade.validateTimer(sampleTimerDefinition, sampleFlowNode as any);
      } catch (error) {
        should(error).be.instanceOf(UnprocessableEntityError);
        should(error.message).be.match(/not in ISO8601 format/i);
      }
    });

    it('Should throw an error, when providing a duration.', (): void => {

      try {
        const sampleTimerDefinition = new Model.Events.Definitions.TimerEventDefinition();
        sampleTimerDefinition.timerType = Model.Events.Definitions.TimerType.timeDate;
        sampleTimerDefinition.value = 'P0Y0M0DT0H0M2S';

        const sampleFlowNode = {};

        timerFacade.validateTimer(sampleTimerDefinition, sampleFlowNode as any);
      } catch (error) {
        should(error).be.instanceOf(UnprocessableEntityError);
        should(error.message).be.match(/not in ISO8601 format/i);
      }
    });

    it('Should throw an error, when providing a completely invalid value.', (): void => {

      try {
        const sampleTimerDefinition = new Model.Events.Definitions.TimerEventDefinition();
        sampleTimerDefinition.timerType = Model.Events.Definitions.TimerType.timeDate;
        sampleTimerDefinition.value = 'asdf';

        const sampleFlowNode = {};

        timerFacade.validateTimer(sampleTimerDefinition, sampleFlowNode as any);
      } catch (error) {
        should(error).be.instanceOf(UnprocessableEntityError);
        should(error.message).be.match(/not in ISO8601 format/i);
      }
    });
  });

  describe('Duration Timers', (): void => {

    it('Should successfully validate the given valid duration timer, regardless of the supplied FlowNode.', (): void => {

      const sampleTimerDefinition = new Model.Events.Definitions.TimerEventDefinition();
      sampleTimerDefinition.timerType = Model.Events.Definitions.TimerType.timeDuration;
      sampleTimerDefinition.value = 'P0Y0M0DT0H0M2S';

      const sampleFlowNode = {};

      timerFacade.validateTimer(sampleTimerDefinition, sampleFlowNode as any);
    });

    it('Should throw an error, when providing a crontab.', (): void => {

      try {
        const sampleTimerDefinition = new Model.Events.Definitions.TimerEventDefinition();
        sampleTimerDefinition.timerType = Model.Events.Definitions.TimerType.timeDuration;
        sampleTimerDefinition.value = '* 5 * * * *';

        const sampleFlowNode = {};

        timerFacade.validateTimer(sampleTimerDefinition, sampleFlowNode as any);
      } catch (error) {
        should(error).be.instanceOf(UnprocessableEntityError);
        should(error.message).be.match(/not in ISO8601 format/i);
      }
    });

    it('Should throw an error, when providing a date.', (): void => {

      try {
        const sampleTimerDefinition = new Model.Events.Definitions.TimerEventDefinition();
        sampleTimerDefinition.timerType = Model.Events.Definitions.TimerType.timeDuration;
        sampleTimerDefinition.value = '2019-08-30T11:30:00.000Z';

        const sampleFlowNode = {};

        timerFacade.validateTimer(sampleTimerDefinition, sampleFlowNode as any);
      } catch (error) {
        should(error).be.instanceOf(UnprocessableEntityError);
        should(error.message).be.match(/not in ISO8601 format/i);
      }
    });

    it('Should throw an error, when providing a completely invalid value.', (): void => {

      try {
        const sampleTimerDefinition = new Model.Events.Definitions.TimerEventDefinition();
        sampleTimerDefinition.timerType = Model.Events.Definitions.TimerType.timeDuration;
        sampleTimerDefinition.value = 'asdf';

        const sampleFlowNode = {};

        timerFacade.validateTimer(sampleTimerDefinition, sampleFlowNode as any);
      } catch (error) {
        should(error).be.instanceOf(UnprocessableEntityError);
        should(error.message).be.match(/not in ISO8601 format/i);
      }
    });

  });

  describe('Sanity Checks', (): void => {

    it('Should succeed, when not providing a FlowNode to a date check.', (): void => {

      const sampleTimerDefinition = new Model.Events.Definitions.TimerEventDefinition();
      sampleTimerDefinition.timerType = Model.Events.Definitions.TimerType.timeDate;
      sampleTimerDefinition.value = '2019-08-30T11:30:00.000Z';

      timerFacade.validateTimer(sampleTimerDefinition, undefined);
    });

    it('Should succeed, when not providing a FlowNode to a duration check.', (): void => {

      const sampleTimerDefinition = new Model.Events.Definitions.TimerEventDefinition();
      sampleTimerDefinition.timerType = Model.Events.Definitions.TimerType.timeDuration;
      sampleTimerDefinition.value = 'P0Y0M0DT0H0M2S';

      timerFacade.validateTimer(sampleTimerDefinition, undefined);
    });

    it('Should throw an error, when not providing a FlowNode with a cyclic timer check.', (): void => {

      try {
        const sampleTimerDefinition = new Model.Events.Definitions.TimerEventDefinition();
        sampleTimerDefinition.timerType = Model.Events.Definitions.TimerType.timeCycle;
        sampleTimerDefinition.value = '* 5 * * * *';

        timerFacade.validateTimer(sampleTimerDefinition, undefined);
      } catch (error) {
        should(error).be.instanceOf(Error);
      }
    });

    it('Should throw an error, when providing no value to a cyclic timer check.', (): void => {

      try {
        const sampleTimerDefinition = new Model.Events.Definitions.TimerEventDefinition();
        sampleTimerDefinition.timerType = Model.Events.Definitions.TimerType.timeCycle;

        const sampleFlowNode = {
          bpmnType: BpmnType.startEvent,
        };

        timerFacade.validateTimer(sampleTimerDefinition, sampleFlowNode as any);
      } catch (error) {
        should(error).be.instanceOf(UnprocessableEntityError);
        should(error.message).be.match(/not a valid crontab/i);
      }
    });

    it('Should throw an error, when providing no value to a date timer check.', (): void => {

      try {
        const sampleTimerDefinition = new Model.Events.Definitions.TimerEventDefinition();
        sampleTimerDefinition.timerType = Model.Events.Definitions.TimerType.timeDate;

        const sampleFlowNode = {};

        timerFacade.validateTimer(sampleTimerDefinition, sampleFlowNode as any);
      } catch (error) {
        should(error).be.instanceOf(UnprocessableEntityError);
        should(error.message).be.match(/not in ISO8601 format/i);
      }
    });

    it('Should throw an error, when providing no value to a duration timer check.', (): void => {

      try {
        const sampleTimerDefinition = new Model.Events.Definitions.TimerEventDefinition();
        sampleTimerDefinition.timerType = Model.Events.Definitions.TimerType.timeDuration;

        const sampleFlowNode = {};

        timerFacade.validateTimer(sampleTimerDefinition, sampleFlowNode as any);
      } catch (error) {
        should(error).be.instanceOf(UnprocessableEntityError);
        should(error.message).be.match(/not in ISO8601 format/i);
      }
    });

    it('Should throw an error, when not providing a Timer Type for any check.', (): void => {

      try {
        const sampleTimerDefinition = new Model.Events.Definitions.TimerEventDefinition();
        sampleTimerDefinition.value = '* * * * 2';

        const sampleFlowNode = {};

        timerFacade.validateTimer(sampleTimerDefinition, sampleFlowNode as any);
      } catch (error) {
        should(error).be.instanceOf(UnprocessableEntityError);
        should(error.message).be.match(/unknown timer definition type/i);
      }
    });
  });
});
