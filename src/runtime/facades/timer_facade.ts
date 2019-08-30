import * as cronparser from 'cron-parser';
import {Logger} from 'loggerhythm';
import * as moment from 'moment';
import * as uuid from 'node-uuid';

import {UnprocessableEntityError} from '@essential-projects/errors_ts';
import {IEventAggregator, Subscription} from '@essential-projects/event_aggregator_contracts';
import {ITimerService} from '@essential-projects/timing_contracts';
import {IProcessTokenFacade, ITimerFacade, TimerDefinitionType} from '@process-engine/process_engine_contracts';
import {BpmnType, Model} from '@process-engine/process_model.contracts';

enum TimerBpmnType {
  Duration = 'bpmn:timeDuration',
  Cycle = 'bpmn:timeCycle',
  Date = 'bpmn:timeDate',
}

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

  // TODO: Too much abstraction - this function should be removed.
  // This will constitute a breaking change for the contracts though.
  public initializeTimerFromDefinition(
    flowNode: Model.Base.FlowNode,
    timerDefinition: Model.Events.Definitions.TimerEventDefinition,
    processTokenFacade: IProcessTokenFacade,
    callback: Function,
  ): Subscription {

    const timerType = this.parseTimerDefinitionType(timerDefinition);
    const timerValueFromDefinition = this.parseTimerDefinitionValue(timerDefinition);
    const timerValue = this.executeTimerExpressionIfNeeded(timerValueFromDefinition, processTokenFacade);

    return this.initializeTimer(flowNode, timerType, timerValue, callback);
  }

  // TODO: Too much abstraction - this function should be removed.
  // This will constitute a breaking change for the contracts though.
  public initializeTimer(
    flowNode: Model.Base.FlowNode,
    timerType: TimerDefinitionType,
    timerValue: string,
    timerCallback: Function,
  ): Subscription {

    this.validateTimer(flowNode, timerType, timerValue);

    const callbackEventName = `${flowNode.id}_${uuid.v4()}`;

    switch (timerType) {
      case TimerDefinitionType.cycle:
        return this.startCycleTimer(timerValue, timerCallback, callbackEventName);
      case TimerDefinitionType.date:
        return this.startDateTimer(timerValue, timerCallback, callbackEventName);
      case TimerDefinitionType.duration:
        return this.startDurationTimer(timerValue, timerCallback, callbackEventName);
      default:
        return undefined;
    }
  }

  public parseTimerDefinitionType(eventDefinition: any): TimerDefinitionType {

    const timerIsCyclic = eventDefinition[TimerBpmnType.Cycle] !== undefined;
    if (timerIsCyclic) {
      return TimerDefinitionType.cycle;
    }

    const timerIsDate = eventDefinition[TimerBpmnType.Date] !== undefined;
    if (timerIsDate) {
      return TimerDefinitionType.date;
    }

    const timerIsDuration = eventDefinition[TimerBpmnType.Duration] !== undefined;
    if (timerIsDuration) {
      return TimerDefinitionType.duration;
    }

    return undefined;
  }

  public parseTimerDefinitionValue(eventDefinition: any): string {

    const timerIsCyclic = eventDefinition[TimerBpmnType.Cycle] !== undefined;
    if (timerIsCyclic) {
      return eventDefinition[TimerBpmnType.Cycle]._;
    }

    const timerIsDate = eventDefinition[TimerBpmnType.Date] !== undefined;
    if (timerIsDate) {
      return eventDefinition[TimerBpmnType.Date]._;
    }

    const timerIsDuration = eventDefinition[TimerBpmnType.Duration] !== undefined;
    if (timerIsDuration) {
      return eventDefinition[TimerBpmnType.Duration]._;
    }

    return undefined;
  }

  public cancelTimerSubscription(subscription: Subscription): void {
    const timerId = this.timerStorage[subscription.eventName];

    this.eventAggregator.unsubscribe(subscription);
    this.timerService.cancel(timerId);
  }

  // TODO: Add function to the public interface
  // TODO: Add flowNode to the signature, so we can call validation.
  public startCycleTimer(timerValue: string, timerCallback: Function, callbackEventName: string): Subscription {

    logger.verbose(`Starting new cyclic timer with definition ${timerValue} and event name ${callbackEventName}`);

    const subscription = this.eventAggregator.subscribe(callbackEventName, (eventPayload, eventName): void => {
      logger.verbose(`Cyclic timer ${eventName} has expired. Executing callback.`);
      timerCallback(eventPayload);
    });

    const timerId = this.timerService.cronjob(timerValue, callbackEventName);

    this.timerStorage[subscription.eventName] = timerId;

    return subscription;
  }

  // TODO: Add function to the public interface
  public startDurationTimer(timerValue: string, timerCallback: Function, callbackEventName: string): Subscription {

    logger.verbose(`Starting new duration timer with definition ${timerValue} and event name ${callbackEventName}`);

    this.validateDurationTimer(timerValue);

    const duration = moment.duration(timerValue);
    const date = moment().add(duration);

    const subscription = this.eventAggregator.subscribeOnce(callbackEventName, (eventPayload, eventName): void => {
      logger.verbose(`Duration timer ${eventName} has expired. Executing callback.`);
      timerCallback(eventPayload);
    });

    const timerId = this.timerService.oneShot(date, callbackEventName);

    this.timerStorage[subscription.eventName] = timerId;

    return subscription;
  }

  // TODO: Add function to the public interface
  public startDateTimer(timerValue: string, timerCallback: Function, callbackEventName: string): Subscription {

    logger.verbose(`Starting new date timer with definition ${timerValue} and event name ${callbackEventName}`);

    this.validateDateTimer(timerValue);

    const date = moment(timerValue);

    const now = moment();

    const dateIsPast = date.isBefore(now);
    if (dateIsPast) {
      const dateIsInThePast = `The given date definition ${date} is in the past and will be executed immediately.`;
      logger.warn(dateIsInThePast);

      return timerCallback({}, callbackEventName);
    }

    const subscription = this.eventAggregator.subscribeOnce(callbackEventName, (eventPayload, eventName): void => {
      logger.verbose(`Date timer ${eventName} has expired. Executing callback.`);
      timerCallback(eventPayload);
    });

    const timerId = this.timerService.oneShot(date, callbackEventName);

    this.timerStorage[subscription.eventName] = timerId;

    return subscription;
  }

  // TODO: Add function to the public interface
  public executeTimerExpressionIfNeeded(timerExpression: string, processTokenFacade: IProcessTokenFacade): string {
    const tokenVariableName = 'token';
    const isConstantTimerExpression = !timerExpression.includes(tokenVariableName);

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

  // TODO: Add function to the public interface
  public validateTimer(flowNode: Model.Base.FlowNode, timerType: TimerDefinitionType, timerValue: string): void {

    switch (timerType) {
      case TimerDefinitionType.date:
        this.validateDateTimer(timerValue);
        break;
      case TimerDefinitionType.duration:
        this.validateDurationTimer(timerValue);
        break;
      case TimerDefinitionType.cycle:
        this.validateCyclicTimer(flowNode, timerValue);
        break;
      default:
        const invalidTimerTypeMessage = `Unknown Timer definition type '${timerType}'`;
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
      error.additionalInformation = <any> flowNode;

      throw error;
    }

    try {
      cronparser.parseExpression(timerValue);
    } catch (error) {
      const errorMessage = `${timerValue} is not a valid crontab!`;
      logger.error(errorMessage, flowNode);

      const invalidCrontabError = new UnprocessableEntityError(errorMessage);
      error.additionalInformation = <any> {
        validationError: error.message,
        flowNode: flowNode,
      };

      throw invalidCrontabError;
    }
  }

}
