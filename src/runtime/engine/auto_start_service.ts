import {EventReceivedCallback, IEventAggregator, Subscription} from '@essential-projects/event_aggregator_contracts';
import {IIdentity, IIdentityService} from '@essential-projects/iam_contracts';

import {
  BpmnType,
  eventAggregatorSettings,
  IAutoStartService,
  IExecuteProcessService,
  IProcessModelService,
  MessageEventReachedMessage,
  Model,
  SignalEventReachedMessage,
} from '@process-engine/process_engine_contracts';

export class AutoStartService implements IAutoStartService {

  private readonly _eventAggregator: IEventAggregator;
  private readonly _executeProcessService: IExecuteProcessService;
  private readonly _identityService: IIdentityService;
  private readonly _processModelService: IProcessModelService;

  private _eventSubscriptions: Array<Subscription>;
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
    // This identity is only used to ensure that the Service can retrieve full ProcessModels.
    // The identity send with an event may not be sufficient to do that,
    // because of possible access restriction to lanes.
    //
    // Note that the users identity is still used to determine which ProcessModels are to be triggerd
    // when an event is received.
    const dummyToken: string = 'ZHVtbXlfdG9rZW4=';
    this._internalIdentity = await this._identityService.getIdentity(dummyToken);
  }

  public async start(): Promise<void> {
    this._createSubscriptionForEvent(eventAggregatorSettings.messagePaths.messageTriggered, this._onMessageReceived);
    this._createSubscriptionForEvent(eventAggregatorSettings.messagePaths.signalTriggered, this._onSignalReceived);
  }

  public async stop(): Promise<void> {
    for (const subscription of this._eventSubscriptions) {
      this._eventAggregator.unsubscribe(subscription);
    }
    this._eventSubscriptions = [];
  }

  private _createSubscriptionForEvent(eventName: string, callback: EventReceivedCallback): void {
    const subscription: Subscription = this._eventAggregator.subscribe(eventName, callback);
    this._eventSubscriptions.push(subscription);
  }

  private async _onMessageReceived(eventData: MessageEventReachedMessage): Promise<void> {
    // This list contains all ProcessModels that the User that triggered the Event has access to.
    const userAccessibleProcessModels: Array<Model.Types.Process> = await this._processModelService.getProcessModels(eventData.processInstanceOwner);

    const eventDefinitionPropertyName: string = 'messageEventDefinition';
    const matchingProcessModels: Array<Model.Types.Process> =
      this._getProcessModelsWithMatchingStartEvents(userAccessibleProcessModels, eventDefinitionPropertyName, eventData.messageReference);

    await this._startProcessInstances(
      matchingProcessModels,
      eventData.processInstanceOwner,
      eventDefinitionPropertyName,
      eventData.messageReference,
      eventData.correlationId,
      eventData.currentToken,
    );
  }

  private async _onSignalReceived(eventData: SignalEventReachedMessage): Promise<void> {
    // This list contains all ProcessModels that the User that triggered the Event has access to.
    const userAccessibleProcessModels: Array<Model.Types.Process> = await this._processModelService.getProcessModels(eventData.processInstanceOwner);

    const eventDefinitionPropertyName: string = 'signalEventDefinition';
    const matchingProcessModels: Array<Model.Types.Process> =
      this._getProcessModelsWithMatchingStartEvents(userAccessibleProcessModels, eventDefinitionPropertyName, eventData.signalReference);

    await this._startProcessInstances(
      matchingProcessModels,
      eventData.processInstanceOwner,
      eventDefinitionPropertyName,
      eventData.signalReference,
      eventData.correlationId,
      eventData.currentToken,
    );
  }

  private _getProcessModelsWithMatchingStartEvents(
    processModels: Array<Model.Types.Process>,
    expectedEventDefinitionName: string,
    eventName: string,
  ): Array<Model.Types.Process> {

    return processModels.filter((processModel: Model.Types.Process) => {

      return processModel.flowNodes.some((flowNode: Model.Base.FlowNode) => {

        return flowNode.bpmnType === BpmnType.startEvent &&
          flowNode[expectedEventDefinitionName] !== undefined &&
          flowNode[expectedEventDefinitionName].name === eventName;
      });
    });
  }

  private async _startProcessInstances(
    processModels: Array<Model.Types.Process>,
    identityToUse: IIdentity,
    eventDefinitionPropertyName: string,
    eventName: string,
    correlationId: string,
    payload: any,
  ): Promise<void> {

    /**
     * Takes a Process model and returns the ID of the StartEvent that has a
     * matching event definition attached to it.
     *
     * @param processModel The ProcessModel for which to get the StartEventId.
     */
    const findMatchingStartEventId: Function = (processModel: Model.Types.Process): string => {

      const matchingFlowNode: Model.Base.FlowNode = processModel.flowNodes.find((flowNode: Model.Base.FlowNode) => {
        return flowNode.bpmnType === BpmnType.startEvent &&
          flowNode[eventDefinitionPropertyName] !== undefined &&
          flowNode[eventDefinitionPropertyName].name === eventName;
      });

      return matchingFlowNode.id;
    };

    for (const processModel of processModels) {
      // We must ensure that the full ProcessModel will be used to start the instance.
      // So we use the internal identity to request the ProcessModel again.
      const fullProcessModel: Model.Types.Process = await this._processModelService.getProcessModelById(this._internalIdentity, processModel.id);
      const startEventIdToUse: string = findMatchingStartEventId(fullProcessModel);

      // We must not await the process instance's end here, or the processes would not run in parallel to each other.
      await this._executeProcessService.start(identityToUse, fullProcessModel, startEventIdToUse, correlationId, payload);
    }
  }
}
