import * as cronparser from 'cron-parser';
import {Logger} from 'loggerhythm';

import {Subscription} from '@essential-projects/event_aggregator_contracts';
import {IIdentity, IIdentityService} from '@essential-projects/iam_contracts';

import {
  ICronjobService,
  IExecuteProcessService,
  ITimerFacade,
  TimerDefinitionType,
} from '@process-engine/process_engine_contracts';
import {BpmnType, IProcessModelUseCases, Model} from '@process-engine/process_model.contracts';

const logger = Logger.createLogger('processengine:runtime:cronjob_service');

type CronjobCollectionEntry = {
  subscription?: Subscription;
  startEventId: string;
  cronjob: string;
};

type CronjobCollection = {[processModelId: string]: Array<CronjobCollectionEntry>};

export class CronjobService implements ICronjobService {

  private readonly executeProcessService: IExecuteProcessService;
  private readonly identityService: IIdentityService;
  private readonly processModelUseCases: IProcessModelUseCases;
  private readonly timerFacade: ITimerFacade;

  private cronjobDictionary: CronjobCollection = {};

  // This identity is used to enable the `ExecuteProcessService` to always get full ProcessModels.
  // It needs those in order to be able to correctly start a ProcessModel.
  private internalIdentity: IIdentity;

  // eslint-disable-next-line @typescript-eslint/member-naming
  private _isRunning = false;

  constructor(
    executeProcessService: IExecuteProcessService,
    identityService: IIdentityService,
    processModelUseCases: IProcessModelUseCases,
    timerFacade: ITimerFacade,
  ) {
    this.executeProcessService = executeProcessService;
    this.identityService = identityService;
    this.processModelUseCases = processModelUseCases;
    this.timerFacade = timerFacade;
  }

  public get isRunning(): boolean {
    return this._isRunning;
  }

  public async initialize(): Promise<void> {
    const dummyToken = 'ZHVtbXlfdG9rZW4=';
    this.internalIdentity = await this.identityService.getIdentity(dummyToken);
  }

  public async start(): Promise<void> {

    if (this.isRunning) {
      return;
    }

    logger.info('Starting up and creating Cronjobs...');

    const processModelsWithCronjobs = await this.getProcessModelsWithCronjobs();

    logger.verbose(`Found ${processModelsWithCronjobs.length} ProcessModels with attached Cronjobs.`);

    for (const processModel of processModelsWithCronjobs) {
      this.createCronjobForProcessModel(processModel);
    }

    this._isRunning = true;

    logger.info('Done.');
  }

  public async stop(): Promise<void> {

    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping all currently running cronjobs...');

    const processModelIds = Object.keys(this.cronjobDictionary);

    for (const processModelId of processModelIds) {
      this.stopCronjobsForProcessModel(processModelId);
    }

    this._isRunning = false;

    logger.info('Done.');
  }

  public addOrUpdate(processModel: Model.Process): void {

    if (!this.isRunning) {
      return;
    }

    const startEventsWithCronjob = this.getCyclicTimerStartEventsForProcessModel(processModel);

    const config = this.cronjobDictionary[processModel.id];

    // If the ProcessModel doesn't have any cronjobs attached to it, we need to cleanup the internal storage,
    // In case the ProessModel had one or more before.
    if (startEventsWithCronjob.length === 0) {

      if (!config) {
        return;
      }

      logger.info(`ProcessModel ${processModel.id} no longer contains any cronjobs. Removing all active jobs for that ProcessModel...`);
      this.stopCronjobsForProcessModel(processModel.id);
      logger.info('Done.');

      return;
    }

    // If the ProcessModel has cronjobs attached to it, we need to sync them with the internal storage.
    // Easiest way to do that is to first remove the ProcessModel from the storage and then adding it in its updated form.
    // This also provides insurance against unintended executions, if a cronjob happens to expire during the update.
    logger.info(`Creating or updating cronjobs for ProcessModel ${processModel.id}...`);
    if (config) {
      this.stopCronjobsForProcessModel(processModel.id);
    }

    this.createCronjobForProcessModel(processModel);
    logger.info('Done. New Cronjobs for ProcessModel: ', this.cronjobDictionary[processModel.id]);
  }

  public remove(processModelId: string): void {
    if (!this.isRunning || !this.cronjobDictionary[processModelId]) {
      return;
    }

    logger.info(`Removing cronjobs for ProcessModel ${processModelId}...`);
    this.stopCronjobsForProcessModel(processModelId);
    logger.info('Done.');
  }

  private async getProcessModelsWithCronjobs(): Promise<Array<Model.Process>> {
    const processModels = await this.processModelUseCases.getProcessModels(this.internalIdentity);

    const filterByCronjobs = (processModel: Model.Process): boolean => {
      const cyclicTimerStartEvents = this.getCyclicTimerStartEventsForProcessModel(processModel);

      return cyclicTimerStartEvents.length > 0;
    };

    const processModelsWithCronjobs = processModels.filter(filterByCronjobs.bind(this));

    return processModelsWithCronjobs;
  }

  private createCronjobForProcessModel(processModel: Model.Process): void {

    const startEventsWithCronjob = this.getCyclicTimerStartEventsForProcessModel(processModel);

    this.cronjobDictionary[processModel.id] = [];

    for (const startEvent of startEventsWithCronjob) {

      const timerValue = this.timerFacade.parseTimerDefinitionValue(startEvent.timerEventDefinition);

      const crontabIsInvalid = !this.isValidCrontab(timerValue);
      if (crontabIsInvalid) {
        logger.error(`Crontab '${timerValue}' on TimerStartEvent '${startEvent.id}' in ProcessModel '${processModel.id}' is invalid!`);

        // If we were to throw an error here, then none of the cronjobs would get started. So just print the error and move on.
        continue;
      }

      const onCronjobExpired = (expiredCronjob: string, processModelId: string): void => {
        logger.info(`A Cronjob for ProcessModel ${processModelId} has expired: `, expiredCronjob);

        this.executeProcessModelWithCronjob(expiredCronjob, processModelId);
      };

      const timerSubscription = this
        .timerFacade
        .initializeTimer(startEvent, TimerDefinitionType.cycle, timerValue, onCronjobExpired.bind(this, timerValue, processModel.id));

      const newCronJobConfig = {
        subscription: timerSubscription,
        startEventId: startEvent.id,
        cronjob: timerValue,
      };

      this.cronjobDictionary[processModel.id].push(newCronJobConfig);
    }
  }

  private getCyclicTimerStartEventsForProcessModel(processModel: Model.Process): Array<Model.Events.StartEvent> {

    const isCyclicTimerStartEvent = (startEvent: Model.Events.StartEvent): boolean => {

      if (!startEvent.timerEventDefinition) {
        return false;
      }

      const timerType = this.timerFacade.parseTimerDefinitionType(startEvent.timerEventDefinition);

      return timerType === TimerDefinitionType.cycle;
    };

    const startEvents = <Array<Model.Events.StartEvent>>
      processModel.flowNodes.filter((flowNode): boolean => flowNode.bpmnType === BpmnType.startEvent);

    const cyclicTimerStartEvents = startEvents.filter(isCyclicTimerStartEvent);

    return cyclicTimerStartEvents;
  }

  private isValidCrontab(crontab: string): boolean {
    try {
      cronparser.parseExpression(crontab);
      return true;
    } catch (error) {
      return false;
    }
  }

  private executeProcessModelWithCronjob(cronjob: string, processModelId: string): void {

    const matchingConfig = this.cronjobDictionary[processModelId].find((config): boolean => config.cronjob === cronjob);

    // Starting the ProcessModel will not be awaited to ensure all ProcessModels are started simultaneously.
    const correlationId = 'started_by_cronjob';
    this.executeProcessService.start(this.internalIdentity, processModelId, correlationId, matchingConfig.startEventId, {});
  }

  private stopCronjobsForProcessModel(processModelId: string): void {

    const configForProcessModel = this.cronjobDictionary[processModelId];

    for (const config of configForProcessModel) {
      this.timerFacade.cancelTimerSubscription(config.subscription);
    }

    delete this.cronjobDictionary[processModelId];
  }

}
