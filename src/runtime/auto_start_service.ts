import {Logger} from 'loggerhythm';

import {EventReceivedCallback, IEventAggregator, Subscription} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';

import {
  IAutoStartService,
  IExecuteProcessService,
  MessageEventReachedMessage,
  SignalEventReachedMessage,
  eventAggregatorSettings,
} from '@process-engine/process_engine_contracts';
import {BpmnType, IProcessModelUseCases, Model} from '@process-engine/process_model.contracts';

const logger: Logger = Logger.createLogger('processengine:runtime:auto_start_service');

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

  /**
   * Callback function for handling Messages.
   * Finds and starts all ProcessModels that contain StartEvents with a
   * matching MessageDefinition.
   *
   * @async
   * @param eventData The payload received with the MessageEvent.
   */
  private async onMessageReceived(eventData: MessageEventReachedMessage): Promise<void> {
    logger.info('Received a message: ', eventData);

    const noMessageReferenceProvided = !eventData || !eventData.messageReference;
    if (noMessageReferenceProvided) {
      logger.info('The payload of the received message did not contain a message name. Skipping execution.');

      return;
    }

    // This list contains all ProcessModels that the User that triggered the Event has access to.
    const userAccessibleProcessModels = await this.processModelUseCases.getProcessModels(eventData.processInstanceOwner);

    logger.verbose(`Found ${userAccessibleProcessModels.length} ProcessModels the user can access.`);

    const eventDefinitionPropertyName = 'messageEventDefinition';
    const matchingProcessModels =
      this.getProcessModelsWithMatchingStartEvents(userAccessibleProcessModels, eventDefinitionPropertyName, eventData.messageReference);

    logger.verbose(`Found ${matchingProcessModels.length} ProcessModels with matching MessageStartEvents.`);
    await this.startProcessInstances(
      matchingProcessModels,
      eventData.processInstanceOwner,
      eventDefinitionPropertyName,
      eventData.messageReference,
      eventData.correlationId,
      eventData.currentToken,
    );
  }

  /**
   * Callback function for handling Signals.
   * Finds and starts all ProcessModels that contain StartEvents with a
   * matching SignalDefinition.
   *
   * @async
   * @param eventData The payload received with the SignalEvent.
   */
  private async onSignalReceived(eventData: SignalEventReachedMessage): Promise<void> {
    logger.info('Received a signal: ', eventData);

    const noSignalReferenceProvided = !eventData || !eventData.signalReference;
    if (noSignalReferenceProvided) {
      logger.info('The payload of the received signal did not contain a Signal name. Skipping execution.');

      return;
    }
    // This list contains all ProcessModels that the User that triggered the Event has access to.
    const userAccessibleProcessModels = await this.processModelUseCases.getProcessModels(eventData.processInstanceOwner);

    logger.verbose(`Found ${userAccessibleProcessModels.length} ProcessModels the user can access.`);

    const eventDefinitionPropertyName = 'signalEventDefinition';
    const matchingProcessModels =
      this.getProcessModelsWithMatchingStartEvents(userAccessibleProcessModels, eventDefinitionPropertyName, eventData.signalReference);

    logger.verbose(`Found ${matchingProcessModels.length} ProcessModels with matching SignalStartEvents.`);
    await this.startProcessInstances(
      matchingProcessModels,
      eventData.processInstanceOwner,
      eventDefinitionPropertyName,
      eventData.signalReference,
      eventData.correlationId,
      eventData.currentToken,
    );
  }

  /**
   * Filters a given list of ProcessModels by a given event definition and
   * event name.
   *
   * Only ProcessModels that are executable and have at least one matching
   * StartEvent are returned.
   *
   * @param   processModels               The ProcessModels to filter.
   * @param   expectedEventDefinitionName The name of the EventDefinition to
   *                                      look for.
   * @param   eventName                   The event name to look for.
   * @returns                             The filtered ProcessModels.
   */
  private getProcessModelsWithMatchingStartEvents(
    processModels: Array<Model.Process>,
    expectedEventDefinitionName: string,
    eventName: string,
  ): Array<Model.Process> {

    const matches = processModels.filter((processModel: Model.Process): boolean => {

      const hasMatchingStartEvents = processModel.flowNodes.some((flowNode: Model.Base.FlowNode): boolean => {
        return flowNode.bpmnType === BpmnType.startEvent &&
          flowNode[expectedEventDefinitionName] !== undefined &&
          flowNode[expectedEventDefinitionName].name === eventName;
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
    /**
     * Takes a Process model and returns the ID of the StartEvent that has a
     * matching event definition attached to it.
     *
     * @param processModel The ProcessModel for which to get the StartEventId.
     */
    const findMatchingStartEventId = (processModel: Model.Process): string => {

      const matchingFlowNode = processModel.flowNodes.find((flowNode: Model.Base.FlowNode): boolean => {
        return flowNode.bpmnType === BpmnType.startEvent &&
          flowNode[eventDefinitionPropertyName] !== undefined &&
          flowNode[eventDefinitionPropertyName].name === eventName;
      });

      return matchingFlowNode.id;
    };

    for (const processModel of processModels) {
      const startEventIdToUse = findMatchingStartEventId(processModel);
      await this.executeProcessService.start(identityToUse, processModel.id, correlationId, startEventIdToUse, payload);
    }
  }

}
