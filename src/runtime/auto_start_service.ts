import {Logger} from 'loggerhythm';

import {EventReceivedCallback, IEventAggregator, Subscription} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';

import {BpmnType, IProcessModelUseCases, Model} from '@process-engine/persistence_api.contracts';
import {
  IAutoStartService,
  IExecuteProcessService,
  MessageEventReachedMessage,
  SignalEventReachedMessage,
  eventAggregatorSettings,
} from '@process-engine/process_engine_contracts';

const logger = Logger.createLogger('processengine:runtime:auto_start_service');

export class AutoStartService implements IAutoStartService {

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
    logger.info('Starting up and creating subscriptions...');
    this.createSubscriptionForEvent(eventAggregatorSettings.messagePaths.messageTriggered, this.onMessageReceived.bind(this));
    this.createSubscriptionForEvent(eventAggregatorSettings.messagePaths.signalTriggered, this.onSignalReceived.bind(this));
    logger.info('Done.');
  }

  public async stop(): Promise<void> {
    logger.info('Stopping...');
    for (const subscription of this.eventSubscriptions) {
      this.eventAggregator.unsubscribe(subscription);
    }
    this.eventSubscriptions = [];
    logger.info('Done.');
  }

  private createSubscriptionForEvent(eventName: string, callback: EventReceivedCallback): void {
    const subscription = this.eventAggregator.subscribe(eventName, callback);
    this.eventSubscriptions.push(subscription);
  }

  private async onMessageReceived(eventData: MessageEventReachedMessage): Promise<void> {
    logger.info('Received a message: ', eventData);

    const noMessageReferenceProvided = !(eventData?.messageReference);
    if (noMessageReferenceProvided) {
      logger.info('The payload of the received message did not contain a message name. Skipping execution.');

      return;
    }

    await this.findAndStartProcessModels(
      'messageEventDefinition',
      eventData.messageReference,
      eventData.processInstanceOwner,
      eventData.correlationId,
      eventData.currentToken,
    );
  }

  private async onSignalReceived(eventData: SignalEventReachedMessage): Promise<void> {
    logger.info('Received a signal: ', eventData);

    const noSignalReferenceProvided = !(eventData?.signalReference);
    if (noSignalReferenceProvided) {
      logger.info('The payload of the received signal did not contain a Signal name. Skipping execution.');

      return;
    }

    await this.findAndStartProcessModels(
      'signalEventDefinition',
      eventData.signalReference,
      eventData.processInstanceOwner,
      eventData.correlationId,
      eventData.currentToken,
    );
  }

  private async findAndStartProcessModels(
    eventDefinitionName: string,
    eventName: string,
    identity: IIdentity,
    correlationId: string,
    tokenPayload: any,
  ): Promise<void> {

    const userAccessibleProcessModels = await this.processModelUseCases.getProcessModels(identity);

    logger.verbose(`Found ${userAccessibleProcessModels.length} ProcessModels the user can access.`);

    const matchingProcessModels =
      this.getProcessModelsWithMatchingStartEvents(userAccessibleProcessModels, eventDefinitionName, eventName);

    logger.verbose(`Found ${matchingProcessModels.length} ProcessModels with matching StartEvents.`);
    await this.startProcessInstances(
      matchingProcessModels,
      identity,
      eventDefinitionName,
      eventName,
      correlationId,
      tokenPayload,
    );
  }

  private getProcessModelsWithMatchingStartEvents(
    processModels: Array<Model.Process>,
    expectedEventDefinitionName: string,
    eventName: string,
  ): Array<Model.Process> {

    const matches = processModels.filter((processModel: Model.Process): boolean => {

      const hasMatchingStartEvents = processModel.flowNodes.some((flowNode: Model.Base.FlowNode): boolean => {
        return flowNode.bpmnType === BpmnType.startEvent && flowNode[expectedEventDefinitionName]?.name === eventName;
      });

      return processModel.isExecutable && hasMatchingStartEvents;
    });

    return matches;
  }

  /**
   * Takes a list of ProcessModels and starts new ProcessInstances for each of them,
   * using the given identity, correlationid and payload as parameters.
   *
   * Note that the execution of the ProcessInstances is NOT awaited.
   *
   * @async
   * @param processModels               The ProcessModels to start.
   * @param identityToUse               The Identity with which to start the
   *                                    new instances.
   * @param eventDefinitionPropertyName The name of the property containing the
   *                                    matching event definition.
   * @param eventName                   The name of the event that matching
   *                                    StartEvents must have.
   * @param correlationId               The ID of the correlation in which to
   *                                    run the new instances.
   * @param payload                     The payload to use as initial token value.
   */
  private async startProcessInstances(
    processModels: Array<Model.Process>,
    identityToUse: IIdentity,
    eventDefinitionPropertyName: string,
    eventName: string,
    correlationId: string,
    payload: any,
  ): Promise<void> {

    logger.verbose(`Starting ${processModels.length} new ProcessInstances.`);

    const findMatchingStartEventId = (processModel: Model.Process): string => {

      const matchingFlowNode = processModel.flowNodes.find((flowNode: Model.Base.FlowNode): boolean => {
        return flowNode.bpmnType === BpmnType.startEvent && flowNode[eventDefinitionPropertyName]?.name === eventName;
      });

      return matchingFlowNode.id;
    };

    for (const processModel of processModels) {
      const startEventIdToUse = findMatchingStartEventId(processModel);
      await this.executeProcessService.start(identityToUse, processModel.id, correlationId, startEventIdToUse, payload);
    }
  }

}
