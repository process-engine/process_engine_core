import {CronJob} from 'cron';
import {Logger} from 'loggerhythm';

import {EventReceivedCallback, IEventAggregator, Subscription} from '@essential-projects/event_aggregator_contracts';
import {IIdentity, IIdentityService} from '@essential-projects/iam_contracts';

import {
  IAutoStartService,
  IExecuteProcessService,
  ITimerFacade,
} from '@process-engine/process_engine_contracts';
import {BpmnType, IProcessModelUseCases, Model} from '@process-engine/process_model.contracts';

const logger = Logger.createLogger('processengine:runtime:auto_start_service');

type CronjobCollectionEntry = {
  job?: CronJob;
  processModelIds: Array<string>;
};

type CronjobCollection = {[jobDefinition: string]: CronjobCollectionEntry};

export class CronjobService implements IAutoStartService {

  private readonly eventAggregator: IEventAggregator;
  private readonly executeProcessService: IExecuteProcessService;
  private readonly identityService: IIdentityService;
  private readonly processModelUseCases: IProcessModelUseCases;
  private readonly timerFacade: ITimerFacade;

  private cronjobDictionary: CronjobCollection = {};

  // This identity is used to enable the `ExecuteProcessService` to always get full ProcessModels.
  // It needs those in order to be able to correctly start a ProcessModel.
  private internalIdentity: IIdentity;

  constructor(
    eventAggregator: IEventAggregator,
    executeProcessService: IExecuteProcessService,
    identityService: IIdentityService,
    processModelUseCases: IProcessModelUseCases,
    timerFacade: ITimerFacade,
  ) {
    this.eventAggregator = eventAggregator;
    this.executeProcessService = executeProcessService;
    this.identityService = identityService;
    this.processModelUseCases = processModelUseCases;
    this.timerFacade = timerFacade;
  }

  public async start(): Promise<void> {
    logger.info('Starting up and creating Cronjobs...');

    await this.createInternalIdentity();

    const processModelsWithCronjobs = await this.getProcessModelsWithCronjobs();

    logger.verbose(`Found ${processModelsWithCronjobs.length} ProcessModels with attached Cronjobs.`);

    for (const processModel of processModelsWithCronjobs) {
      this.createCronjobForProcessModel(processModel);
    }

    logger.info('Done.');
  }

  public async stop(): Promise<void> {
    logger.info('Stopping...');
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
        this.cronjobDictionary[timerValue].processModelIds.push(processModel.id);
      } else {

        // TODO - Enhance TimerFacade with payloads for expired timers
        // Then Use TimerFacade instead.
        const cronjob = new CronJob({
          cronTime: timerValue,
          onTick: this.onCronjobExpired,
          context: this,
        });

        const newCronJobConfig = {
          job: {},
          processModelIds: [processModel.id],
        };

        Object.assign(newCronJobConfig.job, cronjob);
        Object.assign(this.cronjobDictionary[timerValue], newCronJobConfig);
      }
    }
  }

  private processModelHasCronjobs(processModel: Model.Process): boolean {
    const cyclicTimerStartEvents = this.getCyclicTimerStartEventsForProcessModel(processModel);

    return cyclicTimerStartEvents.length > 0;
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

  private async onCronjobExpired(): Promise<void> {
    logger.info('A Cronjob has expired: ');
  }

  private async createInternalIdentity(): Promise<void> {
    const dummyToken = 'ZHVtbXlfdG9rZW4=';
    this.internalIdentity = await this.identityService.getIdentity(dummyToken);
  }

}
