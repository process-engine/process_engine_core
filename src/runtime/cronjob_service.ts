import * as cronparser from 'cron-parser';
import {Logger} from 'loggerhythm';
import * as moment from 'moment';
import * as uuid from 'node-uuid';

import {IEventAggregator, Subscription} from '@essential-projects/event_aggregator_contracts';
import {IIdentity, IIdentityService} from '@essential-projects/iam_contracts';

import {
  BpmnType,
  Cronjob,
  ICronjobHistoryService,
  IProcessModelUseCases,
  Model,
} from '@process-engine/persistence_api.contracts';
import {
  CronjobBaseEventMessage,
  CronjobConfiguration,
  ICronjobService,
  IExecuteProcessService,
  ITimerFacade,
  eventAggregatorSettings,
} from '@process-engine/process_engine_contracts';

import {ProcessTokenFacade} from './facades/process_token_facade';

const logger = Logger.createLogger('processengine:runtime:cronjob_service');

type CronjobCollectionEntry = {
  subscription?: Subscription;
  startEventId: string;
  cronjob: string;
};

type CronjobCollection = {[processModelId: string]: Array<CronjobCollectionEntry>};

export class CronjobService implements ICronjobService {

  private readonly cronjobHistoryService: ICronjobHistoryService;
  private readonly eventAggregator: IEventAggregator;
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
    cronjobHistoryService: ICronjobHistoryService,
    eventAggregator: IEventAggregator,
    executeProcessService: IExecuteProcessService,
    identityService: IIdentityService,
    processModelUseCases: IProcessModelUseCases,
    timerFacade: ITimerFacade,
  ) {
    this.cronjobHistoryService = cronjobHistoryService;
    this.eventAggregator = eventAggregator;
    this.executeProcessService = executeProcessService;
    this.identityService = identityService;
    this.processModelUseCases = processModelUseCases;
    this.timerFacade = timerFacade;
  }

  public get isRunning(): boolean {
    return this._isRunning;
  }

  public async initialize(): Promise<void> {
    const internalToken = 'UHJvY2Vzc0VuZ2luZUludGVybmFsVXNlcg==';
    this.internalIdentity = await this.identityService.getIdentity(internalToken);
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
      this.eventAggregator.publish(eventAggregatorSettings.messagePaths.cronjobCreated, this.getEventMessage(processModel.id));
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
      const eventMessage = this.getEventMessage(processModelId);
      this.stopCronjobsForProcessModel(processModelId);
      this.eventAggregator.publish(eventAggregatorSettings.messagePaths.cronjobStopped, eventMessage);
    }

    this._isRunning = false;

    logger.info('Done.');
  }

  public getActive(): Array<CronjobConfiguration> {

    const processModelsInStorage = Object.keys(this.cronjobDictionary);

    if (processModelsInStorage.length === 0) {
      return [];
    }

    let cronjobs: Array<CronjobConfiguration> = [];

    for (const processModelId of processModelsInStorage) {
      const cronjobsForProcessModel = this.cronjobDictionary[processModelId];

      const cronjobConfigs = cronjobsForProcessModel.map((entry): CronjobConfiguration => {
        const nextExecution = cronparser
          .parseExpression(entry.cronjob)
          .next()
          .toDate();

        return {
          processModelId: processModelId,
          startEventId: entry.startEventId,
          crontab: entry.cronjob,
          nextExecution: nextExecution,
        };
      });
      cronjobs = cronjobs.concat(...cronjobConfigs);
    }

    return cronjobs;
  }

  public addOrUpdate(processModel: Model.Process): void {

    if (!this.isRunning) {
      return;
    }

    const startEventsWithActiveCronjob = this.getActiveCyclicTimerStartEventsForProcessModel(processModel);

    const config = this.cronjobDictionary[processModel.id];

    // If the ProcessModel doesn't have any cronjobs attached to it, we need to cleanup the internal storage,
    // In case the ProessModel had one or more before.
    if (startEventsWithActiveCronjob.length === 0) {

      if (!config) {
        return;
      }

      logger.info(`ProcessModel ${processModel.id} no longer contains any active cronjobs. Removing all active jobs for that ProcessModel...`);
      const eventMessage = this.getEventMessage(processModel.id);
      this.stopCronjobsForProcessModel(processModel.id);
      this.eventAggregator.publish(eventAggregatorSettings.messagePaths.cronjobStopped, eventMessage);
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

    const eventToPublish = config ? eventAggregatorSettings.messagePaths.cronjobUpdated : eventAggregatorSettings.messagePaths.cronjobCreated;
    this.eventAggregator.publish(eventToPublish, this.getEventMessage(processModel.id));

    logger.info('Done. New Cronjobs for ProcessModel: ', this.cronjobDictionary[processModel.id]);
  }

  public remove(processModelId: string): void {
    if (!this.isRunning || !this.cronjobDictionary[processModelId]) {
      return;
    }

    logger.info(`Removing cronjobs for ProcessModel ${processModelId}...`);
    const eventMessage = this.getEventMessage(processModelId);
    this.stopCronjobsForProcessModel(processModelId);
    this.eventAggregator.publish(eventAggregatorSettings.messagePaths.cronjobRemoved, eventMessage);
    logger.info('Done.');
  }

  private async getProcessModelsWithCronjobs(): Promise<Array<Model.Process>> {
    const processModels = await this.processModelUseCases.getProcessModels(this.internalIdentity);

    const filterByCronjobs = (processModel: Model.Process): boolean => {
      const cyclicTimerStartEvents = this.getActiveCyclicTimerStartEventsForProcessModel(processModel);

      return cyclicTimerStartEvents.length > 0;
    };

    const processModelsWithCronjobs = processModels.filter(filterByCronjobs.bind(this));

    return processModelsWithCronjobs;
  }

  private createCronjobForProcessModel(processModel: Model.Process): void {

    const startEventsWithCronjob = this.getActiveCyclicTimerStartEventsForProcessModel(processModel);

    this.cronjobDictionary[processModel.id] = [];

    for (const startEvent of startEventsWithCronjob) {

      const timerValue = startEvent.timerEventDefinition.value;

      const crontabIsInvalid = !this.isValidCrontab(timerValue);
      if (crontabIsInvalid) {
        logger.error(`Crontab '${timerValue}' on TimerStartEvent '${startEvent.id}' in ProcessModel '${processModel.id}' is invalid!`);

        // If we were to throw an error here, then none of the cronjobs would get started. So just print the error and move on.
        continue;
      }

      const onCronjobExpired = (expiredCronjob: string, processModelId: string, startEventId: string): void => {
        logger.info(`A Cronjob for ProcessModel ${processModelId} has expired: `, expiredCronjob);

        this.executeProcessModelWithCronjob(expiredCronjob, processModelId);
        this.eventAggregator.publish(eventAggregatorSettings.messagePaths.cronjobExecuted, this.getEventMessage(processModelId, startEventId));
      };

      const dummyProcessTokenFacade = new ProcessTokenFacade(undefined, processModel.id, undefined, this.internalIdentity);

      const timerSubscription = this.timerFacade.initializeTimer(
        startEvent,
        startEvent.timerEventDefinition,
        dummyProcessTokenFacade,
        onCronjobExpired.bind(this, timerValue, processModel.id, startEvent.id),
      );

      const newCronJobConfig = {
        subscription: timerSubscription,
        startEventId: startEvent.id,
        cronjob: timerValue,
      };

      this.cronjobDictionary[processModel.id].push(newCronJobConfig);

    }
  }

  private getActiveCyclicTimerStartEventsForProcessModel(processModel: Model.Process): Array<Model.Events.StartEvent> {

    const startEvents = processModel.flowNodes.filter((flowNode): boolean => flowNode.bpmnType === BpmnType.startEvent);

    const cyclicTimerStartEvents = startEvents.filter((startEvent: Model.Events.StartEvent): boolean => {

      if (!startEvent.timerEventDefinition) {
        return false;
      }

      const timerType = startEvent.timerEventDefinition.timerType;

      const isCyclicTimer = timerType === Model.Events.Definitions.TimerType.timeCycle;
      const isActive = startEvent.timerEventDefinition.enabled;

      return isCyclicTimer && isActive;
    });

    return <Array<Model.Events.StartEvent>> cyclicTimerStartEvents;
  }

  private isValidCrontab(crontab: string): boolean {
    try {
      cronparser.parseExpression(crontab);
      return true;
    } catch (error) {
      return false;
    }
  }

  private executeProcessModelWithCronjob(crontab: string, processModelId: string): void {

    const matchingConfig = this.cronjobDictionary[processModelId].find((config): boolean => config.cronjob === crontab);

    // Starting the ProcessModel will not be awaited to ensure all ProcessModels are started simultaneously.
    const correlationId = `cronjob_${uuid.v4()}`;
    this.executeProcessService.start(this.internalIdentity, processModelId, correlationId, matchingConfig.startEventId, {});

    const cronjobHistoryEntry: Cronjob = {
      processModelId: processModelId,
      startEventId: matchingConfig.startEventId,
      crontab: crontab,
      executedAt: moment().toDate(),
    };

    this.cronjobHistoryService.create(this.internalIdentity, cronjobHistoryEntry);
  }

  private stopCronjobsForProcessModel(processModelId: string): void {

    const configForProcessModel = this.cronjobDictionary[processModelId];

    for (const config of configForProcessModel) {
      this.timerFacade.cancelTimerSubscription(config.subscription);
    }

    delete this.cronjobDictionary[processModelId];
  }

  private getEventMessage(processModelId: string, startEventId?: string): CronjobBaseEventMessage {
    const cronjobsForProcessModel = this.cronjobDictionary[processModelId];
    const cronjobWithStartEvent = [];

    if (startEventId) {
      const cronjobForProcessModel = this
        .cronjobDictionary[processModelId]
        .find((cronjob: CronjobCollectionEntry): boolean => cronjob.startEventId === startEventId);

      cronjobWithStartEvent.push(cronjobForProcessModel);
    }

    const eventMessage: CronjobBaseEventMessage = {
      processModelId: processModelId,
      cronjobs: startEventId ? cronjobWithStartEvent : cronjobsForProcessModel,
    };

    return eventMessage;
  }

}
