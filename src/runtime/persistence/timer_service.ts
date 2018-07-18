import {IEventAggregator} from '@essential-projects/event_aggregator_contracts';
import {ITimerRepository, ITimerService, Runtime} from '@process-engine/process_engine_contracts';

import * as moment from 'moment';
import * as schedule from 'node-schedule';

interface IJobsCache {
  [timerId: string]: schedule.Job;
}

export class TimerService implements ITimerService {

  private _jobs: IJobsCache = {};

  private _eventAggregator: IEventAggregator = undefined;
  private _timerRepository: ITimerRepository = undefined;

  public config: any = undefined;

  private oneShotTimerType: number = 0;

  constructor(eventAggregator: IEventAggregator, timerRepository: ITimerRepository) {
    this._eventAggregator = eventAggregator;
    this._timerRepository = timerRepository;
  }

  private get eventAggregator(): IEventAggregator {
    return this._eventAggregator;
  }

  private get timerRepository(): ITimerRepository {
    return this._timerRepository;
  }

  public async initialize(): Promise<void> {
    return this.restorePersistedJobs();
  }

  public async cancel(timerId: string): Promise<void> {

    const job: schedule.Job = this._getJob(timerId);

    if (job) {
      schedule.cancelJob(job);
      this._removeJob(timerId);
    }

    await this.timerRepository.removeById(timerId);
  }

  public async once(date: moment.Moment, eventName: string): Promise<string> {

    if (!date) {
      throw new Error('Must provide an expiration date for a one-shot timer!');
    }

    return this._createTimer(Runtime.Types.TimerType.once, date, undefined, eventName);
  }

  public async periodic(rule: Runtime.Types.TimingRule, eventName: string): Promise<string> {

    if (!rule) {
      throw new Error('Must provide a rule for a periodic timer!');
    }

    return this._createTimer(Runtime.Types.TimerType.periodic, undefined, rule, eventName);
  }

  private async _createTimer(timerType: Runtime.Types.TimerType,
                             timerDate: moment.Moment,
                             timerRule: Runtime.Types.TimingRule,
                             eventName: string): Promise<string> {

    const timerData: any = {
      type: timerType,
      expirationDate: timerDate || null,
      rule: timerRule,
      eventName: eventName,
    };

    const timerIsValidTimerEntry: Boolean = this._isValidTimer(timerData);

    const createdTimerId: string = await this.timerRepository.create(timerData);

    if (timerIsValidTimerEntry) {
      timerData.id = createdTimerId;
      this._createJob(createdTimerId, timerData, eventName);
    }

    return createdTimerId;
  }

  public async restorePersistedJobs(): Promise<void> {

    const persistedTimers: Array<Runtime.Types.Timer> = await this.timerRepository.getAll();

    const filteredTimers: Array<Runtime.Types.Timer> = this._getValidTimersToRestoreFromList(persistedTimers);

    for (const timer of filteredTimers) {
      const timerIsValidTimerEntry: Boolean = this._isValidTimer(timer);

      if (timerIsValidTimerEntry) {
        this._createJob(timer.id, timer, timer.eventName);
      }
    }
  }

  private _getValidTimersToRestoreFromList(timers: Array<Runtime.Types.Timer>): Array<Runtime.Types.Timer> {

    const filteredTimers: Array<Runtime.Types.Timer> = timers.filter((timer: Runtime.Types.Timer): boolean => {

      const isNotOneShotTimer: boolean = timer.type !== Runtime.Types.TimerType.once;
      const isValidOneShotTimer: boolean =
        timer.type === Runtime.Types.TimerType.once &&
        (timer.lastElapsed === undefined || timer.lastElapsed === null);

      return isNotOneShotTimer || isValidOneShotTimer;
    });

    return filteredTimers;
  }

  private _isValidTimer(timer: Runtime.Types.Timer): boolean {

    const timerIsOneShotTimer: boolean = timer.type === this.oneShotTimerType;

    let isValidTimer: boolean = true;

    if (timerIsOneShotTimer) {

      if (!timer.expirationDate) {
        return false;
      }

      const timerDate: moment.Moment = timer.expirationDate;
      const now: moment.Moment = moment();

      const exectionTimeIsBefore: boolean = timerDate.isAfter(now);

      isValidTimer = timer.lastElapsed !== null || exectionTimeIsBefore;
    }

    return isValidTimer;
  }

  private _createJob(timerId: string, timer: Runtime.Types.Timer, eventName: string): schedule.Job {

    const timerValue: Runtime.Types.TimingRule | Date = timer.type === Runtime.Types.TimerType.periodic
        ? timer.rule
        : timer.expirationDate.toDate();

    const job: schedule.Job = schedule.scheduleJob(timerValue, async() => {
      return this._timerElapsed(timerId, eventName);
    });

    if (!job) {
      throw new Error('an error occured during job scheduling');
    }

    this._cacheJob(timerId, job);

    return job;
  }

  private async _timerElapsed(timerId: string, eventName: string): Promise<void> {
    await this.timerRepository.setLastElapsedById(timerId, new Date());
    this.eventAggregator.publish(eventName);
  }

  private _getJob(timerId: string): schedule.Job {
    return this._jobs[timerId];
  }

  private _cacheJob(timerId: string, job: schedule.Job): void {
    this._jobs[timerId] = job;
  }

  private _removeJob(timerId: string): void {
    if (this._jobs[timerId]) {
      delete this._jobs[timerId];
    }
  }
}
