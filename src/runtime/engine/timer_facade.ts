import {IEventAggregator, Subscription} from '@essential-projects/event_aggregator_contracts';
import {ITimerService, TimerRule} from '@essential-projects/timing_contracts';
import {ITimerFacade, Model, TimerDefinitionType} from '@process-engine/process_engine_contracts';

import * as moment from 'moment';
import * as uuid from 'node-uuid';

enum TimerBpmnType {
  Duration = 'bpmn:timeDuration',
  Cycle = 'bpmn:timeCycle',
  Date = 'bpmn:timeDate',
}

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

  public initializeTimer(flowNode: Model.Base.FlowNode,
                         timerType: TimerDefinitionType,
                         timerValue: string,
                         timerCallback: Function): Subscription {

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
}
