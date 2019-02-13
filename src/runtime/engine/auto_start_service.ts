import {IEventAggregator, Subscription} from '@essential-projects/event_aggregator_contracts';
import {IIdentity, IIdentityService} from '@essential-projects/iam_contracts';

import {
  eventAggregatorSettings,
  IAutoStartService,
  IExecuteProcessService,
  IProcessModelService,
  MessageEventReachedMessage,
  SignalEventReachedMessage,
} from '@process-engine/process_engine_contracts';

export class AutoStartService implements IAutoStartService {

  private readonly _eventAggregator: IEventAggregator;
  private readonly _executeProcessService: IExecuteProcessService;
  private readonly _identityService: IIdentityService;
  private readonly _processModelService: IProcessModelService;

  private _eventSubscriptions: Array<Subscription>;

  private _internalIdentity: IIdentity;

  constructor(
    eventAggregator: IEventAggregator,
    executeProcessService: IExecuteProcessService,
    identityService: IIdentityService,
    processModelService: IProcessModelService,
  ) {
    this._eventAggregator = eventAggregator;
    this._executeProcessService = executeProcessService;
    this._identityService = identityService;
    this._processModelService = processModelService;
  }

  public async initialize(): Promise<void> {
    // TODO: As soon as it is available, this should be replaced
    // with a token that was actually created by an external authority.
    const dummyToken: string = 'ZHVtbXlfdG9rZW4=';
    this._internalIdentity = await this._identityService.getIdentity(dummyToken);
  }

  public async start(): Promise<void> {
    this._startListeningForEvents();

    return Promise.resolve();
  }

  public async stop(): Promise<void> {
    this._stopListeningForEvents();

    return Promise.resolve();
  }

  private _startListeningForEvents(): void {

    const subscriptionForSignals: Subscription =
      this._eventAggregator.subscribe(eventAggregatorSettings.messagePaths.signalTriggered, this._onSignalReceived);

    const subscriptionForMessages: Subscription =
      this._eventAggregator.subscribe(eventAggregatorSettings.messagePaths.messageTriggered, this._onMessageReceived);

    this._eventSubscriptions = [subscriptionForSignals, subscriptionForMessages];
  }

  private _stopListeningForEvents(): void {
    for (const subscription of this._eventSubscriptions) {
      this._eventAggregator.unsubscribe(subscription);
    }
    this._eventSubscriptions = [];
  }

  private _onMessageReceived(eventData: MessageEventReachedMessage): Promise<void> {

  }

  private _onSignalReceived(eventData: SignalEventReachedMessage): Promise<void> {

  }
}
