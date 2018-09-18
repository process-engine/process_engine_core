import {IEventAggregator, ISubscription} from '@essential-projects/event_aggregator_contracts';
import {ITimerService, TimerRule} from '@essential-projects/timing_contracts';
import {ITimerFacade, Model, TimerDefinitionType} from '@process-engine/process_engine_contracts';

import * as moment from 'moment';
import * as uuid from 'uuid';

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

  public async initializeTimer(flowNode: Model.Base.FlowNode,
                               timerType: TimerDefinitionType,
                               timerValue: string,
                               timerCallback: Function): Promise<ISubscription> {

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

  private async _startCycleTimer(timerDefinition: string,
                                 timerCallback: Function,
                                 callbackEventName: string): Promise<ISubscription> {

    const duration: moment.Duration = moment.duration(timerDefinition);

    const timingRule: TimerRule = {
      year: duration.years(),
      month: duration.months(),
      date: duration.days(),
      hour: duration.hours(),
      minute: duration.minutes(),
      second: duration.seconds(),
    };

    const subscription: ISubscription = this.eventAggregator.subscribe(callbackEventName, () => {
      timerCallback();
    });

    await this.timerService.periodic(timingRule, callbackEventName);

    return subscription;
  }

  private async _startDurationTimer(timerDefinition: string,
                                    timerCallback: Function,
                                    callbackEventName: string): Promise<ISubscription> {

    const duration: moment.Duration = moment.duration(timerDefinition);
    const date: moment.Moment = moment().add(duration);

    const subscription: ISubscription = this.eventAggregator.subscribeOnce(callbackEventName, () => {
      timerCallback();
    });

    await this.timerService.once(date, callbackEventName);

    return subscription;
  }

  private async _startDateTimer(timerDefinition: string,
                                timerCallback: Function,
                                callbackEventName: string): Promise<ISubscription> {

    const date: moment.Moment = moment(timerDefinition);

    const subscription: ISubscription = this.eventAggregator.subscribeOnce(callbackEventName, () => {
      timerCallback();
    });

    await this.timerService.once(date, callbackEventName);

    return subscription;
  }
}
