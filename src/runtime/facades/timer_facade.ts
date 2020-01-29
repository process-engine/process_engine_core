import * as cronparser from 'cron-parser';
import {Logger} from 'loggerhythm';
import * as moment from 'moment';
import * as uuid from 'node-uuid';

import {BadRequestError, UnprocessableEntityError} from '@essential-projects/errors_ts';
import {IEventAggregator, Subscription} from '@essential-projects/event_aggregator_contracts';
import {ITimerService} from '@essential-projects/timing_contracts';
import {BpmnType, Model} from '@process-engine/persistence_api.contracts';
import {IProcessTokenFacade, ITimerFacade} from '@process-engine/process_engine_contracts';

type TimerId = string;
type TimerIdStorage = {[eventSubscriptionId: string]: TimerId};

const logger = Logger.createLogger('processengine:runtime:timer_facade');

export class TimerFacade implements ITimerFacade {

  private eventAggregator: IEventAggregator;
  private timerService: ITimerService;

  private timerStorage: TimerIdStorage = {};

  constructor(eventAggregator: IEventAggregator, timerService: ITimerService) {
    this.eventAggregator = eventAggregator;
    this.timerService = timerService;
  }

  public initializeTimer(
    flowNode: Model.Base.FlowNode,
    timerEventDefinition: Model.Events.Definitions.TimerEventDefinition,
    processTokenFacade: IProcessTokenFacade,
    timerCallback: Function,
  ): Subscription {

    const timerValue = this.executeTimerExpressionIfNeeded(timerEventDefinition.value, processTokenFacade);

    const timerExpiredEventName = `${flowNode.id}_${uuid.v4()}`;

    switch (timerEventDefinition.timerType) {
      case Model.Events.Definitions.TimerType.timeCycle:
        return this.startCycleTimer(timerValue, flowNode, timerCallback, timerExpiredEventName);
      case Model.Events.Definitions.TimerType.timeDate:
        return this.startDateTimer(timerValue, timerCallback, timerExpiredEventName);
      case Model.Events.Definitions.TimerType.timeDuration:
        return this.startDurationTimer(timerValue, timerCallback, timerExpiredEventName);
      default:
        return undefined;
    }
  }

  public cancelTimerSubscription(subscription: Subscription): void {
    this.eventAggregator.unsubscribe(subscription);

    if (subscription?.eventName) {
      const timerId = this.timerStorage[subscription.eventName];
      this.timerService.cancel(timerId);
    }
  }

  public startCycleTimer(timerValue: string, flowNode: Model.Base.FlowNode, timerCallback: Function, timerExpiredEventName: string): Subscription {

    logger.verbose(`Starting new cyclic timer with definition ${timerValue} and event name ${timerExpiredEventName}`);

    if (!timerCallback) {
      logger.error('Must provide a callback when initializing a new timer!');
      throw new BadRequestError('Must provide a callback when initializing a new timer!');
    }

    this.validateCyclicTimer(flowNode, timerValue);

    const subscription = this.eventAggregator.subscribe(timerExpiredEventName, (eventPayload, eventName): void => {
      logger.verbose(`Cyclic timer ${eventName} has expired. Executing callback.`);
      timerCallback(eventPayload);
    });

    const timerId = this.timerService.cronjob(timerValue, timerExpiredEventName);

    this.timerStorage[subscription.eventName] = timerId;

    return subscription;
  }

  public startDateTimer(timerValue: string, timerCallback: Function, timerExpiredEventName: string): Subscription {

    logger.verbose(`Starting new date timer with definition ${timerValue} and event name ${timerExpiredEventName}`);

    if (!timerCallback) {
      logger.error('Must provide a callback when initializing a new timer!');
      throw new BadRequestError('Must provide a callback when initializing a new timer!');
    }

    this.validateDateTimer(timerValue);

    const date = moment(timerValue);
    const now = moment();

    const dateIsPast = date.isBefore(now);
    if (dateIsPast) {
      const dateIsInThePast = `The given date definition ${date} is in the past and will be executed immediately.`;
      logger.warn(dateIsInThePast);

      return timerCallback({}, timerExpiredEventName);
    }

    const subscription = this.eventAggregator.subscribeOnce(timerExpiredEventName, (eventPayload, eventName): void => {
      logger.verbose(`Date timer ${eventName} has expired. Executing callback.`);
      timerCallback(eventPayload);
    });

    const timerId = this.timerService.oneShot(date, timerExpiredEventName);

    this.timerStorage[subscription.eventName] = timerId;

    return subscription;
  }

  public startDurationTimer(timerValue: string, timerCallback: Function, timerExpiredEventName: string): Subscription {

    logger.verbose(`Starting new duration timer with definition ${timerValue} and event name ${timerExpiredEventName}`);

    if (!timerCallback) {
      logger.error('Must provide a callback when initializing a new timer!');
      throw new BadRequestError('Must provide a callback when initializing a new timer!');
    }

    this.validateDurationTimer(timerValue);

    const duration = moment.duration(timerValue);
    const date = moment().add(duration);

    const subscription = this.eventAggregator.subscribeOnce(timerExpiredEventName, (eventPayload, eventName): void => {
      logger.verbose(`Duration timer ${eventName} has expired. Executing callback.`);
      timerCallback(eventPayload);
    });

    const timerId = this.timerService.oneShot(date, timerExpiredEventName);

    this.timerStorage[subscription.eventName] = timerId;

    return subscription;
  }

  public executeTimerExpressionIfNeeded(timerExpression: string, processTokenFacade: IProcessTokenFacade): string {
    const tokenVariableName = 'token';
    const isConstantTimerExpression = !timerExpression || !timerExpression.includes(tokenVariableName);

    if (isConstantTimerExpression) {
      return timerExpression;
    }

    const tokenData = processTokenFacade.getOldTokenFormat();
    try {
      const functionString = `return ${timerExpression}`;
      const evaluateFunction = new Function(tokenVariableName, functionString);

      return evaluateFunction.call(tokenData, tokenData);
    } catch (err) {
      logger.error(err);
      throw err;
    }
  }

  public validateTimer(timerDefinition: Model.Events.Definitions.TimerEventDefinition, flowNode: Model.Base.FlowNode): void {

    switch (timerDefinition.timerType) {
      case Model.Events.Definitions.TimerType.timeDate:
        this.validateDateTimer(timerDefinition.value);
        break;
      case Model.Events.Definitions.TimerType.timeDuration:
        this.validateDurationTimer(timerDefinition.value);
        break;
      case Model.Events.Definitions.TimerType.timeCycle:
        this.validateCyclicTimer(flowNode, timerDefinition.value);
        break;
      default:
        const invalidTimerTypeMessage = `Unknown Timer definition type '${timerDefinition}'`;
        logger.error(invalidTimerTypeMessage);
        throw new UnprocessableEntityError(invalidTimerTypeMessage);
    }
  }

  private validateDateTimer(timerValue: string): void {
    const dateIsInvalid = !moment(timerValue, moment.ISO_8601, true).isValid();
    if (dateIsInvalid) {
      const invalidDateMessage = `The given date definition ${timerValue} is not in ISO8601 format!`;
      logger.error(invalidDateMessage);
      throw new UnprocessableEntityError(invalidDateMessage);
    }
  }

  private validateDurationTimer(timerValue: string): void {
    /**
     * Note: Because of this Issue: https://github.com/moment/moment/issues/1805
     * we can't use moment to validate durations against the ISO8601 duration syntax.
     *
     * There is an isValid() method on moment.Duration objects but its
     * useless since it always returns true.
     */

    /**
     * Taken from: https://stackoverflow.com/a/32045167
     */
    // eslint-disable-next-line max-len
    const durationRegex = /^P(?!$)(\d+(?:\.\d+)?Y)?(\d+(?:\.\d+)?M)?(\d+(?:\.\d+)?W)?(\d+(?:\.\d+)?D)?(T(?=\d)(\d+(?:\.\d+)?H)?(\d+(?:\.\d+)?M)?(\d+(?:\.\d+)?S)?)?$/gm;
    const durationIsInvalid = !durationRegex.test(timerValue);

    if (durationIsInvalid) {
      const invalidDurationMessage = `The given duration definition ${timerValue} is not in ISO8601 format`;
      logger.error(invalidDurationMessage);
      throw new UnprocessableEntityError(invalidDurationMessage);
    }
  }

  private validateCyclicTimer(flowNode: Model.Base.FlowNode, timerValue: string): void {

    if (flowNode.bpmnType !== BpmnType.startEvent) {
      const errorMessage = 'Cyclic timers are only allowed for TimerStartEvents!';
      logger.error(errorMessage, flowNode);

      const error = new UnprocessableEntityError(errorMessage);
      error.additionalInformation = flowNode;

      throw error;
    }

    try {
      cronparser.parseExpression(timerValue);
    } catch (error) {
      const errorMessage = `${timerValue} is not a valid crontab!`;
      logger.error(errorMessage, flowNode);

      const invalidCrontabError = new UnprocessableEntityError(errorMessage);
      error.additionalInformation = {
        validationError: error.message,
        flowNode: flowNode,
      };

      throw invalidCrontabError;
    }
  }

}
