import * as moment from 'moment';

export class TimerServiceMock {

  public oneShot(date: moment.Moment, eventName: string): string {
    return '';
  }

  public cronjob(crontab: string, eventName: string): string {
    return '';
  }

  public cancel(timerId: string): void {}

}
