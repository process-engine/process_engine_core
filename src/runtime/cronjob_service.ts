import {Logger} from 'loggerhythm';

import {EventReceivedCallback, IEventAggregator, Subscription} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';

import {
  IAutoStartService,
  IExecuteProcessService,
} from '@process-engine/process_engine_contracts';
import {BpmnType, IProcessModelUseCases, Model} from '@process-engine/process_model.contracts';

const logger = Logger.createLogger('processengine:runtime:auto_start_service');

export class CronjobService implements IAutoStartService {

  private readonly eventAggregator: IEventAggregator;
  private readonly executeProcessService: IExecuteProcessService;
  private readonly processModelUseCases: IProcessModelUseCases;

  private eventSubscriptions: Array<Subscription> = [];

  constructor(
    eventAggregator: IEventAggregator,
    executeProcessService: IExecuteProcessService,
    processModelService: IProcessModelUseCases,
  ) {
    this.eventAggregator = eventAggregator;
    this.executeProcessService = executeProcessService;
    this.processModelUseCases = processModelService;
  }

  public async start(): Promise<void> {
    logger.info('Starting up and creating Cronjobs...');
    logger.info('Done.');
  }

  public async stop(): Promise<void> {
    logger.info('Stopping...');
    logger.info('Done.');
  }

  private createCronjobForTimerEvent(eventName: string, callback: EventReceivedCallback): void {
    const subscription = this.eventAggregator.subscribe(eventName, callback);
    this.eventSubscriptions.push(subscription);
  }

  private async onCronjobExpired(): Promise<void> {
    logger.info('A Cronjob has expired: ');
  }

  private async findAndStartProcessModels(
    cronjob: string,
    identity: IIdentity,
    correlationId: string,
    tokenPayload: any,
  ): Promise<void> {
    return Promise.resolve();
  }

  private getProcessModelsWithMatchingStartEvents(
    processModels: Array<Model.Process>,
    cronjob: string,
  ): Array<Model.Process> {
    return [];
  }

  private async startProcessInstances(
    processModels: Array<Model.Process>,
    identityToUse: IIdentity,
    cronjob: string,
    correlationId: string,
    payload: any,
  ): Promise<void> {
    return Promise.resolve();
  }

}
