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

const logger = Logger.createLogger('processengine:runtime:auto_start_service');

type CronjobCollectionEntry = {
  subscription?: Subscription;
  processModelIds: Array<string>;
};

type CronjobCollection = {[jobDefinition: string]: CronjobCollectionEntry};

export class CronjobService implements ICronjobService {

  private readonly executeProcessService: IExecuteProcessService;
  private readonly identityService: IIdentityService;
  private readonly processModelUseCases: IProcessModelUseCases;
  private readonly timerFacade: ITimerFacade;

  private cronjobDictionary: CronjobCollection = {};

  // This identity is used to enable the `ExecuteProcessService` to always get full ProcessModels.
  // It needs those in order to be able to correctly start a ProcessModel.
  private internalIdentity: IIdentity;

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

  public async initialize(): Promise<void> {
    const dummyToken = 'ZHVtbXlfdG9rZW4=';
    this.internalIdentity = await this.identityService.getIdentity(dummyToken);
  }

  public async start(): Promise<void> {
    logger.info('Starting up and creating Cronjobs...');

    const processModelsWithCronjobs = await this.getProcessModelsWithCronjobs();

    logger.verbose(`Found ${processModelsWithCronjobs.length} ProcessModels with attached Cronjobs.`);

    for (const processModel of processModelsWithCronjobs) {
      this.createCronjobForProcessModel(processModel);
    }

    logger.info('Done.');
  }

  public async stop(): Promise<void> {
    logger.info('Stopping all currently running cronjobs...');

    const jobs = Object.keys(this.cronjobDictionary);

    for (const job of jobs) {
      const cronjobConfig = this.cronjobDictionary[job];
      this.timerFacade.cancelTimerSubscription(cronjobConfig.subscription);

      delete this.cronjobDictionary[job];
    }

    logger.info('Done.');
  }

  public addOrUpdate(processModel: Model.Process): void {
    throw new Error('Method not implemented.');
  }

  public remove(processModelId: string): void {

    logger.info(`Removing ProcessModel ${processModelId} from all cronjobs...`);

    const jobs = Object.keys(this.cronjobDictionary);
    for (const job of jobs) {

      const cronjobConfig = this.cronjobDictionary[job];

      const matchingIndexInConfig = cronjobConfig.processModelIds.findIndex((entry): boolean => entry === processModelId);

      const processModelNotFound = matchingIndexInConfig === -1;
      if (processModelNotFound) {
        continue;
      }

      logger.verbose(`Removing ProcessModel '${processModelId}' from cronjob '${job}'`);

      cronjobConfig.processModelIds.splice(matchingIndexInConfig, 1);

      const configStillContainsProcessModels = cronjobConfig.processModelIds.length > 0;
      if (configStillContainsProcessModels) {
        continue;
      }

      logger.info(`Removing orphaned cronjob '${job}', since it no longer triggers any ProcessModels.`);

      this.timerFacade.cancelTimerSubscription(cronjobConfig.subscription);

      delete this.cronjobDictionary[job];
    }

    logger.info('Done.');
  }

  private async getProcessModelsWithCronjobs(): Promise<Array<Model.Process>> {

    const processModels = await this.processModelUseCases.getProcessModels(this.internalIdentity);

    const processModelsWithCronjobs = processModels.filter(this.processModelHasCronjobs);

    return processModelsWithCronjobs;
  }

  private createCronjobForProcessModel(processModel: Model.Process): void {

    const startEventsWithCronjob = this.getCyclicTimerStartEventsForProcessModel(processModel);

    for (const startEvent of startEventsWithCronjob) {

      const timerValue = this.timerFacade.parseTimerDefinitionValue(startEvent.timerEventDefinition);

      if (this.cronjobDictionary[timerValue] !== undefined) {
        // Just in case somebody configured the same cronjob on multiple StartEvents
        const processModelIdNotYetStored =
          !this.cronjobDictionary[timerValue].processModelIds.some((processModelId): boolean => processModelId === processModel.id);

        if (processModelIdNotYetStored) {
          this.cronjobDictionary[timerValue].processModelIds.push(processModel.id);
        }
      } else {

        const onCronjobExpired = (expiredCronjob: string): void => {
          logger.info('A Cronjob has expired: ', expiredCronjob);

          const matchingCronjobConfig = this.cronjobDictionary[expiredCronjob];

          if (!matchingCronjobConfig) {
            logger.warn('No matching config was found! The cronjob may be an orphan.');
            return;
          }

          logger.verbose('Found a matching config. Executing ProcessModels with Ids: ', matchingCronjobConfig.processModelIds);

          this.executeProcessModelsForExpiredCronjob(expiredCronjob, matchingCronjobConfig);
        };

        const timerSubscription = this
          .timerFacade
          .initializeTimer(startEvent, TimerDefinitionType.cycle, timerValue, onCronjobExpired.bind(this, timerValue));

        const newCronJobConfig = {
          subscription: timerSubscription,
          processModelIds: [processModel.id],
        };

        this.cronjobDictionary[timerValue] = newCronJobConfig;
      }
    }
  }

  private processModelHasCronjobs(processModel: Model.Process): boolean {
    const cyclicTimerStartEvents = this.getCyclicTimerStartEventsForProcessModel(processModel);

    return cyclicTimerStartEvents.length > 0;
  }

  private async executeProcessModelsForExpiredCronjob(cronjob: string, config: CronjobCollectionEntry): Promise<void> {

    for (const processModelId of config.processModelIds) {

      const processModel = await this.processModelUseCases.getProcessModelById(this.internalIdentity, processModelId);

      const matchingStartEvent = this.findStartEventWithMatchingCronjob(cronjob, processModel);
      if (!matchingStartEvent) {
        logger.warn(`The ProcessModel '${processModelId}' no longer has any StartEvent with the cronjob '${cronjob}' on it.`);
        continue;
      }

      // Starting the ProcessModel will not be awaited to ensure all ProcessModels are started simultaneously.
      const correlationId = `started_by_cronjob ${cronjob}`;
      this.executeProcessService.start(this.internalIdentity, processModelId, correlationId, matchingStartEvent.id, {});
    }
  }

  private findStartEventWithMatchingCronjob(cronjob: string, processModel: Model.Process): Model.Events.StartEvent {

    const timerStartEvents = this.getCyclicTimerStartEventsForProcessModel(processModel);

    const matchingStartEvent = timerStartEvents.find((startEvent): boolean => {
      const timerValue = this.timerFacade.parseTimerDefinitionValue(startEvent.timerEventDefinition);
      return timerValue === cronjob;
    });

    return matchingStartEvent;
  }

  private getCyclicTimerStartEventsForProcessModel(processModel: Model.Process): Array<Model.Events.StartEvent> {

    const isCyclicTimerStartEvent = (startEvent: Model.Events.StartEvent): boolean => {
      const isCyclicTimer =
        startEvent.timerEventDefinition !== undefined &&
        startEvent.timerEventDefinition.timerType === Model.Events.Definitions.TimerType.timeCycle;

      return isCyclicTimer;
    };

    const startEvents = <Array<Model.Events.StartEvent>>
      processModel.flowNodes.filter((flowNode): boolean => flowNode.bpmnType === BpmnType.startEvent);

    const cyclicTimerStartEvents = startEvents.filter(isCyclicTimerStartEvent);

    return cyclicTimerStartEvents;
  }

}
