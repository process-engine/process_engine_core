import {Logger} from 'loggerhythm';
import * as moment from 'moment';
import * as uuid from 'node-uuid';

import {UnprocessableEntityError} from '@essential-projects/errors_ts';
import {IEventAggregator, Subscription} from '@essential-projects/event_aggregator_contracts';
import {ITimerService, TimerRule} from '@essential-projects/timing_contracts';
import {IProcessTokenFacade, ITimerFacade, TimerDefinitionType} from '@process-engine/process_engine_contracts';
import {Model} from '@process-engine/process_model.contracts';

enum TimerBpmnType {
  Duration = 'bpmn:timeDuration',
  Cycle = 'bpmn:timeCycle',
  Date = 'bpmn:timeDate',
}

const logger: Logger = Logger.createLogger('processengine:runtime:timer_facade');

export class TimerFacade implements ITimerFacade {

  private _eventAggregator: IEventAggregator;
  private _timerService: ITimerService;

  constructor(eventAggregator: IEventAggregator, timerService: ITimerService) {
    this._eventAggregator = eventAggregator;
    this._timerService = timerService;
  }

  private get eventAggregator(): IEventAggregator {
    return this._eventAggregator;
  }

  private get timerService(): ITimerService {
    return this._timerService;
  }

  public initializeTimerFromDefinition(
    flowNode: Model.Base.FlowNode,
    timerDefinition: Model.EventDefinitions.TimerEventDefinition,
    processTokenFacade: IProcessTokenFacade,
    callback: Function,
  ): Subscription {

    const timerType: TimerDefinitionType = this.parseTimerDefinitionType(timerDefinition);
    const timerValueFromDefinition: string = this.parseTimerDefinitionValue(timerDefinition);
    const timerValue: string = this._executeTimerExpressionIfNeeded(timerValueFromDefinition, processTokenFacade);

    return this.initializeTimer(flowNode, timerType, timerValue, callback);
  }

  public initializeTimer(
    flowNode: Model.Base.FlowNode,
    timerType: TimerDefinitionType,
    timerValue: string,
    timerCallback: Function,
  ): Subscription {

    this._validateTimer(timerType, timerValue);

    const callbackEventName: string = `${flowNode.id}_${uuid.v4()}`;

    switch (timerType) {
      case TimerDefinitionType.cycle:
        return this._startCycleTimer(timerValue, timerCallback, callbackEventName);
      case TimerDefinitionType.date:
        return this._startDateTimer(timerValue, timerCallback, callbackEventName);
      case TimerDefinitionType.duration:
        return this._startDurationTimer(timerValue, timerCallback, callbackEventName);
      default:
    }
  }

  public parseTimerDefinitionType(eventDefinition: any): TimerDefinitionType {

    const timerIsDuration: boolean = eventDefinition[TimerBpmnType.Duration] !== undefined;
    if (timerIsDuration) {
      return TimerDefinitionType.duration;
    }

    const timerIsCyclic: boolean = eventDefinition[TimerBpmnType.Cycle] !== undefined;
    if (timerIsCyclic) {
      return TimerDefinitionType.cycle;
    }

    const timerIsDate: boolean = eventDefinition[TimerBpmnType.Date] !== undefined;
    if (timerIsDate) {
      return TimerDefinitionType.date;
    }

    return undefined;
  }

  public parseTimerDefinitionValue(eventDefinition: any): string {

    const timerIsDuration: boolean = eventDefinition[TimerBpmnType.Duration] !== undefined;
    if (timerIsDuration) {
      return eventDefinition[TimerBpmnType.Duration]._;
    }

    const timerIsCyclic: boolean = eventDefinition[TimerBpmnType.Cycle] !== undefined;
    if (timerIsCyclic) {
      return eventDefinition[TimerBpmnType.Cycle]._;
    }

    const timerIsDate: boolean = eventDefinition[TimerBpmnType.Date] !== undefined;
    if (timerIsDate) {
      return eventDefinition[TimerBpmnType.Date]._;
    }

    return undefined;
  }

  public cancelTimerSubscription(subscription: Subscription): void {
    this._eventAggregator.unsubscribe(subscription);
  }

  private _startCycleTimer(timerDefinition: string, timerCallback: Function, callbackEventName: string): Subscription {

    const duration: moment.Duration = moment.duration(timerDefinition);

    const timingRule: TimerRule = {
      year: duration.years(),
      month: duration.months(),
      date: duration.days(),
      hour: duration.hours(),
      minute: duration.minutes(),
      second: duration.seconds(),
    };

    const subscription: Subscription = this.eventAggregator.subscribe(callbackEventName, () => {
      timerCallback();
    });

    this.timerService.periodic(timingRule, callbackEventName);

    return subscription;
  }

  private _startDurationTimer(timerDefinition: string, timerCallback: Function, callbackEventName: string): Subscription {

    const duration: moment.Duration = moment.duration(timerDefinition);
    const date: moment.Moment = moment().add(duration);

    const subscription: Subscription = this.eventAggregator.subscribeOnce(callbackEventName, () => {
      timerCallback();
    });

    this.timerService.once(date, callbackEventName);

    return subscription;
  }

  private _startDateTimer(timerDefinition: string, timerCallback: Function, callbackEventName: string): Subscription {

    const date: moment.Moment = moment(timerDefinition);

    const subscription: Subscription = this.eventAggregator.subscribeOnce(callbackEventName, () => {
      timerCallback();
    });

    this.timerService.once(date, callbackEventName);

    return subscription;
  }

  private _executeTimerExpressionIfNeeded(timerExpression: string, processTokenFacade: IProcessTokenFacade): string {
    const tokenVariableName: string = 'token';
    const isConstantTimerExpression: boolean = !timerExpression.includes(tokenVariableName);

    if (isConstantTimerExpression) {
      return timerExpression;
    }

    const tokenData: any = processTokenFacade.getOldTokenFormat();

    try {
      const functionString: string = `return ${timerExpression}`;
      const evaluateFunction: Function = new Function(tokenVariableName, functionString);

      return evaluateFunction.call(tokenData, tokenData);
    } catch (err) {
      logger.error(err);
      throw err;
    }
  }

  private _validateTimer(timerType: TimerDefinitionType, timerValue: string): void {

    switch (timerType) {
      case TimerDefinitionType.date:
        const dateIsInvalid: boolean = !moment(timerValue, moment.ISO_8601).isValid();
        if (dateIsInvalid) {
          const invalidDateMessage: string = `The given date definition ${timerValue} is not in ISO8601 format`;
          logger.error(invalidDateMessage);
          throw new UnprocessableEntityError(invalidDateMessage);
        }

        break;
      case TimerDefinitionType.duration:
        /**
         * Note: Because of this Issue: https://github.com/moment/moment/issues/1805
         * we can't really use momentjs to validate durations against the
         * ISO8601 duration syntax.
         *
         * There is an isValid() method on moment.Duration objects but its
         * useless since it always returns true.
         */

        /**
         * Taken from: https://stackoverflow.com/a/32045167
         */
         /*tslint:disable-next-line:max-line-length*/
        const durationRegex: RegExp = /^P(?!$)(\d+(?:\.\d+)?Y)?(\d+(?:\.\d+)?M)?(\d+(?:\.\d+)?W)?(\d+(?:\.\d+)?D)?(T(?=\d)(\d+(?:\.\d+)?H)?(\d+(?:\.\d+)?M)?(\d+(?:\.\d+)?S)?)?$/gm;
        const durationIsInvalid: boolean = !durationRegex.test(timerValue);

        if (durationIsInvalid) {
          const invalidDurationMessage: string = `The given duration definition ${timerValue} is not in ISO8601 format`;
          logger.error(invalidDurationMessage);
          throw new UnprocessableEntityError(invalidDurationMessage);
        }

        break;
      case TimerDefinitionType.cycle:
        logger.error('Attempted to parse a cyclic timer! this is currently not supported!');
        throw new UnprocessableEntityError('Cyclic timer definitions are currently not supported!');
      default:
        const invalidTimerTypeMessage: string = `Unknown Timer definition type '${timerType}'`;
        logger.error(invalidTimerTypeMessage);
        throw new UnprocessableEntityError(invalidTimerTypeMessage);
    }
  }
}
