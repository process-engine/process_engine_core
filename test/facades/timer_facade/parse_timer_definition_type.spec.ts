import * as should from 'should';

import {TimerDefinitionType} from '@process-engine/process_engine_contracts';

import {TimerFacade} from '../../../src/runtime/facades/timer_facade';
import {TestFixtureProvider} from '../../test_fixture_provider';

// NOTE: This function is now located in the EventParser.
// So these tests might still prove useful, when writing tests for that parser.
describe.skip('TimerFacade.parseTimerDefinitionType', (): void => {

  let fixtureProvider: TestFixtureProvider;
  let timerFacade: TimerFacade;

  before(async (): Promise<void> => {
    fixtureProvider = new TestFixtureProvider();
    await fixtureProvider.initialize();

    timerFacade = await fixtureProvider.createTimerFacade();
  });

  describe('Execution', (): void => {

    it('Should return "TimerBpmnType.Cycle" for a Definition containing a cyclic timer.', (): void => {

      // NOTE: This is how this definition actually looks like after it was parsed.
      // See TODO in /src/model/parser/flow_node_parsers/event_parser.ts Line 223.
      const sampleDefinition = {
        'bpmn:timeCycle': {
          _: '*/2 * * * * *',
        },
        enabled: true,
      };

      const timerType = timerFacade.parseTimerDefinitionType(sampleDefinition);
      should(timerType).be.equal(TimerDefinitionType.cycle);
    });

    it('Should return "TimerBpmnType.Date" for a Definition containing a date timer.', (): void => {

      const sampleDefinition = {
        'bpmn:timeDate': {
          _: '2019-08-30T11:30:00.000Z',
        },
        enabled: true,
      };

      const timerType = timerFacade.parseTimerDefinitionType(sampleDefinition);
      should(timerType).be.equal(TimerDefinitionType.date);
    });

    it('Should return "TimerBpmnType.Duration" for a Definition containing a duration timer.', (): void => {

      const sampleDefinition = {
        'bpmn:timeDuration': {
          _: 'P0Y0M0DT0H0M2S',
        },
        enabled: true,
      };

      const timerType = timerFacade.parseTimerDefinitionType(sampleDefinition);
      should(timerType).be.equal(TimerDefinitionType.duration);
    });
  });

  describe('Sanity Checks', (): void => {

    it('Should return "TimerBpmnType.Cycle" for a Definition containing a cyclic timer, even if the value is not valid.', (): void => {

      // NOTE: This is how this definition actually looks like after it was parsed.
      // See TODO in /src/model/parser/flow_node_parsers/event_parser.ts Line 223.
      const sampleDefinition = {
        'bpmn:timeCycle': {
          _: 'asdf',
        },
        enabled: true,
      };

      const timerType = timerFacade.parseTimerDefinitionType(sampleDefinition);
      should(timerType).be.equal(TimerDefinitionType.cycle);
    });

    it('Should return "TimerBpmnType.Date" for a Definition containing a date timer, even if the value is not valid.', (): void => {

      const sampleDefinition = {
        'bpmn:timeDate': {
          _: 'asdf',
        },
        enabled: true,
      };

      const timerType = timerFacade.parseTimerDefinitionType(sampleDefinition);
      should(timerType).be.equal(TimerDefinitionType.date);
    });

    it('Should return "TimerBpmnType.Duration" for a Definition containing a duration timer, even if the value is not valid.', (): void => {

      const sampleDefinition = {
        'bpmn:timeDuration': {
          _: 'asdf',
        },
        enabled: true,
      };

      const timerType = timerFacade.parseTimerDefinitionType(sampleDefinition);
      should(timerType).be.equal(TimerDefinitionType.duration);
    });

    it('Should return "undefined" for a Definition without any timer.', (): void => {

      const sampleDefinition = {};

      const timerType = timerFacade.parseTimerDefinitionType(sampleDefinition);
      should.not.exist(timerType, 'This should not have returned a value!');
    });

    it('Should return "undefined" for a Definition with an unsupported timer.', (): void => {

      const sampleDefinition = {
        'bpmn:timeUnsupported': {
          _: '*/2 * * * * *',
        },
        enabled: true,
      };

      const timerType = timerFacade.parseTimerDefinitionType(sampleDefinition);
      should.not.exist(timerType, 'This should not have returned a value!');
    });
  });
});
