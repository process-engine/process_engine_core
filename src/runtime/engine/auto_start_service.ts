import {IEventAggregator} from '@essential-projects/event_aggregator_contracts';

import {IAutoStartService, IExecuteProcessService, IProcessModelService} from '@process-engine/process_engine_contracts';

export class AutoStartService implements IAutoStartService {

  private readonly _eventAggregator: IEventAggregator;
  private readonly _executeProcessService: IExecuteProcessService;
  private readonly _processModelService: IProcessModelService;

  constructor(
    eventAggregator: IEventAggregator,
    executeProcessService: IExecuteProcessService,
    processModelService: IProcessModelService,
  ) {
    this._eventAggregator = eventAggregator;
    this._executeProcessService = executeProcessService;
    this._processModelService = processModelService;
  }

  public async start(): Promise<void> {
    return Promise.resolve();
  }

  public async stop(): Promise<void> {
    return Promise.resolve();
  }
}
