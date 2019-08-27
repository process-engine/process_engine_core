import {EventReceivedCallback, Subscription} from '@essential-projects/event_aggregator_contracts';

export class EventAggregatorMock {

  public subscribe(eventName: string, callback: EventReceivedCallback): Subscription {
    return {} as any;
  }

  public subscribeOnce(eventName: string, callback: EventReceivedCallback): Subscription {
    return {} as any;
  }

  public publish(eventName: string, payload?: any): void {}

  public unsubscribe(subscription: Subscription): void {}

}
