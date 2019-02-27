import {Logger} from 'loggerhythm';

import {EventReceivedCallback, IEventAggregator, Subscription} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';

import {
  eventAggregatorSettings,
  IAutoStartService,
  IExecuteProcessService,
  MessageEventReachedMessage,
  SignalEventReachedMessage,
} from '@process-engine/process_engine_contracts';
import {BpmnType, IProcessModelUseCases, Model} from '@process-engine/process_model.contracts';

const logger: Logger = Logger.createLogger('processengine:runtime:auto_start_service');

export class AutoStartService implements IAutoStartService {

  private readonly _eventAggregator: IEventAggregator;
  private readonly _executeProcessService: IExecuteProcessService;
  private readonly _processModelUseCases: IProcessModelUseCases;

  private _eventSubscriptions: Array<Subscription> = [];

  constructor(
    eventAggregator: IEventAggregator,
    executeProcessService: IExecuteProcessService,
    processModelService: IProcessModelUseCases,
  ) {
    this._eventAggregator = eventAggregator;
    this._executeProcessService = executeProcessService;
    this._processModelUseCases = processModelService;
  }

  public async start(): Promise<void> {
    logger.info('Starting up and creating subscriptions...');
    this._createSubscriptionForEvent(eventAggregatorSettings.messagePaths.messageTriggered, this._onMessageReceived.bind(this));
    this._createSubscriptionForEvent(eventAggregatorSettings.messagePaths.signalTriggered, this._onSignalReceived.bind(this));
    logger.info('Done.');
  }

  public async stop(): Promise<void> {
    logger.info('Stopping...');
    for (const subscription of this._eventSubscriptions) {
      this._eventAggregator.unsubscribe(subscription);
    }
    this._eventSubscriptions = [];
    logger.info('Done.');
  }

  private _createSubscriptionForEvent(eventName: string, callback: EventReceivedCallback): void {
    const subscription: Subscription = this._eventAggregator.subscribe(eventName, callback);
    this._eventSubscriptions.push(subscription);
  }

  /**
   * Callback function for handling Messages.
   * Finds and starts all ProcessModels that contain StartEvents with a
   * matching MessageDefinition.
   *
   * @async
   * @param eventData The payload received with the MessageEvent.
   */
  private async _onMessageReceived(eventData: MessageEventReachedMessage): Promise<void> {
    logger.info('Received a message: ', eventData);

    const noMessageReferenceProvided: boolean = !eventData || !eventData.messageReference;
    if (noMessageReferenceProvided) {
      logger.info('The payload of the received message did not contain a message name. Skipping execution.');

      return;
    }

    // This list contains all ProcessModels that the User that triggered the Event has access to.
    const userAccessibleProcessModels: Array<Model.Process> = await this._processModelUseCases.getProcessModels(eventData.processInstanceOwner);

    logger.verbose(`Found ${userAccessibleProcessModels.length} ProcessModels the user can access.`);

    const eventDefinitionPropertyName: string = 'messageEventDefinition';
    const matchingProcessModels: Array<Model.Process> =
      this._getProcessModelsWithMatchingStartEvents(userAccessibleProcessModels, eventDefinitionPropertyName, eventData.messageReference);

    logger.verbose(`Found ${matchingProcessModels.length} ProcessModels with matching MessageStartEvents.`);
    await this._startProcessInstances(
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
  private async _onSignalReceived(eventData: SignalEventReachedMessage): Promise<void> {
    logger.info('Received a signal: ', eventData);

    const noSignalReferenceProvided: boolean = !eventData || !eventData.signalReference;
    if (noSignalReferenceProvided) {
      logger.info('The payload of the received signal did not contain a Signal name. Skipping execution.');

      return;
    }
    // This list contains all ProcessModels that the User that triggered the Event has access to.
    const userAccessibleProcessModels: Array<Model.Process> = await this._processModelUseCases.getProcessModels(eventData.processInstanceOwner);

    logger.verbose(`Found ${userAccessibleProcessModels.length} ProcessModels the user can access.`);

    const eventDefinitionPropertyName: string = 'signalEventDefinition';
    const matchingProcessModels: Array<Model.Process> =
      this._getProcessModelsWithMatchingStartEvents(userAccessibleProcessModels, eventDefinitionPropertyName, eventData.signalReference);

    logger.verbose(`Found ${matchingProcessModels.length} ProcessModels with matching SignalStartEvents.`);
    await this._startProcessInstances(
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
  private _getProcessModelsWithMatchingStartEvents(
    processModels: Array<Model.Process>,
    expectedEventDefinitionName: string,
    eventName: string,
  ): Array<Model.Process> {

    const matches: Array<Model.Process> = processModels.filter((processModel: Model.Process) => {

      const hasMatchingStartEvents: boolean =
        processModel.flowNodes.some((flowNode: Model.Base.FlowNode) => {

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
  private async _startProcessInstances(
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
    const findMatchingStartEventId: Function = (processModel: Model.Process): string => {

      const matchingFlowNode: Model.Base.FlowNode = processModel.flowNodes.find((flowNode: Model.Base.FlowNode) => {
        return flowNode.bpmnType === BpmnType.startEvent &&
          flowNode[eventDefinitionPropertyName] !== undefined &&
          flowNode[eventDefinitionPropertyName].name === eventName;
      });

      return matchingFlowNode.id;
    };

    for (const processModel of processModels) {
      const startEventIdToUse: string = findMatchingStartEventId(processModel);
      await this._executeProcessService.start(identityToUse, processModel.id, correlationId, startEventIdToUse, payload);
    }
  }
}
