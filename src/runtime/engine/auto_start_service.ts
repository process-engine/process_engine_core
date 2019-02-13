import {IEventAggregator, Subscription} from '@essential-projects/event_aggregator_contracts';
import {IIdentity, IIdentityService} from '@essential-projects/iam_contracts';

import {
  eventAggregatorSettings,
  IAutoStartService,
  IExecuteProcessService,
  IProcessModelService,
} from '@process-engine/process_engine_contracts';

export class AutoStartService implements IAutoStartService {

  private readonly _eventAggregator: IEventAggregator;
  private readonly _executeProcessService: IExecuteProcessService;
  private readonly _identityService: IIdentityService;
  private readonly _processModelService: IProcessModelService;

  private readonly _eventSubscriptions: Array<Subscription>;

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
    return Promise.resolve();
  }

  public async stop(): Promise<void> {
    return Promise.resolve();
  }
}
