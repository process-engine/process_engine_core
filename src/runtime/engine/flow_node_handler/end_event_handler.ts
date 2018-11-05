import {IEventAggregator} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';

import {ILoggingApi} from '@process-engine/logging_api_contracts';
import {IMetricsApi} from '@process-engine/metrics_api_contracts';
import {
  EndEventReachedMessage,
  eventAggregatorSettings,
  IFlowNodeInstanceService,
  IProcessModelFacade,
  IProcessTokenFacade,
  MessageEventReachedMessage,
  Model,
  NextFlowNodeInfo,
  Runtime,
  SignalEventReachedMessage,
  TerminateEndEventReachedMessage,
} from '@process-engine/process_engine_contracts';

import {FlowNodeHandler} from './index';

export class EndEventHandler extends FlowNodeHandler<Model.Events.EndEvent> {

  private _eventAggregator: IEventAggregator;

  constructor(eventAggregator: IEventAggregator,
              flowNodeInstanceService: IFlowNodeInstanceService,
              loggingApiService: ILoggingApi,
              metricsService: IMetricsApi) {
    super(flowNodeInstanceService, loggingApiService, metricsService);
    this._eventAggregator = eventAggregator;
  }

  private get eventAggregator(): IEventAggregator {
    return this._eventAggregator;
  }

  protected async executeInternally(endEvent: Model.Events.EndEvent,
                                    token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    identity: IIdentity): Promise<NextFlowNodeInfo> {

    await this.persistOnEnter(endEvent, token);

    const flowNodeIsTerminateEndEvent: boolean = endEvent.terminateEventDefinition !== undefined;
    const flowNodeIsErrorEndEvent: boolean = endEvent.errorEventDefinition !== undefined;
    const flowNodeIsMessageEndEvent: boolean = endEvent.messageEventDefinition !== undefined;
    const flowNodeIsSignalEndEvent: boolean = endEvent.signalEventDefinition !== undefined;

    let errorObj: any;

    // Event persisting
    if (flowNodeIsTerminateEndEvent) {
      await this.persistOnTerminate(endEvent, token);
    } else {
      await this.persistOnExit(endEvent, token);
    }

    // Event notifications
    if (flowNodeIsTerminateEndEvent) {
      this._notifyAboutTermination(endEvent, token);
    } else if (flowNodeIsErrorEndEvent) {
      errorObj = this._createErrorForEndEvent(endEvent);
    } else if (flowNodeIsMessageEndEvent) {
      this._sendMessage(endEvent, token);
    } else if (flowNodeIsSignalEndEvent) {
      this._sendSignal(endEvent, token);
    } else {
      this._notifyAboutRegularEnd(endEvent, token);
    }

    // Finalization
    if (flowNodeIsErrorEndEvent) {
      // ErrorEndEvents need to cause Promise rejection with the matching error object.
      return Promise.reject(errorObj);
    }

    return new NextFlowNodeInfo(undefined, token, processTokenFacade);
  }

  /**
   * When a MessageEndEvent is used, an event with the corresponding message is
   * published to the EventAggregator.
   * Afterwards, the process finishes regularly.
   *
   * @param flowNode The FlowNode containing the Message definition
   * @param token    The current ProcessToken.
   */
  private _sendMessage(flowNode: Model.Events.EndEvent, token: Runtime.Types.ProcessToken): void {

    // Send message to processes that may be waiting for it.
    const messageName: string = flowNode.messageEventDefinition.name;

    const eventName: string = eventAggregatorSettings.routePaths.messageEventReached
      .replace(eventAggregatorSettings.routeParams.messageReference, messageName);

    const message: MessageEventReachedMessage = new MessageEventReachedMessage(messageName,
                                                                               token.correlationId,
                                                                               token.processModelId,
                                                                               token.processInstanceId,
                                                                               flowNode.id,
                                                                               token.payload);
    this.eventAggregator.publish(eventName, message);

    this._notifyAboutRegularEnd(flowNode, token);
  }

  /**
   * When a SignalEndEvent is used, an event with the corresponding signal is
   * published to the EventAggregator.
   * Afterwards, the process finishes regularly.
   *
   * @param flowNode The FlowNode containing the Message definition
   * @param token    The current ProcessToken.
   */
  private _sendSignal(flowNode: Model.Events.EndEvent, token: Runtime.Types.ProcessToken): void {

    // Send message to processes that may be waiting for it.
    const signalName: string = flowNode.signalEventDefinition.name;

    const eventName: string = eventAggregatorSettings.routePaths.signalEventReached
      .replace(eventAggregatorSettings.routeParams.signalReference, signalName);

    const message: SignalEventReachedMessage = new SignalEventReachedMessage(signalName,
                                                                             token.correlationId,
                                                                             token.processModelId,
                                                                             token.processInstanceId,
                                                                             flowNode.id,
                                                                             token.payload);
    this.eventAggregator.publish(eventName, message);

    this._notifyAboutRegularEnd(flowNode, token);
  }

  /**
   * When a TerminateEndEvent is used, an event with the corresponding
   * termination notification is published to the EventAggregator.
   *
   * @param flowNode The FlowNode containing the termination definition
   * @param token    The current ProcessToken.
   */
  private _notifyAboutTermination(flowNode: Model.Events.EndEvent, token: Runtime.Types.ProcessToken): void {

    // Publish termination message to cancel all FlowNodeInstance executions and
    // finish with an error.
    const eventName: string = eventAggregatorSettings.routePaths.terminateEndEventReached
      .replace(eventAggregatorSettings.routeParams.processInstanceId, token.processInstanceId);

    const message: TerminateEndEventReachedMessage = new TerminateEndEventReachedMessage(token.correlationId,
                                                                                         token.processModelId,
                                                                                         token.processInstanceId,
                                                                                         flowNode.id,
                                                                                         token.payload);
    this.eventAggregator.publish(eventName, message);

    // Send global message about a reached TerminateEndEvent
    this.eventAggregator.publish(eventAggregatorSettings.messagePaths.processTerminated, message);
  }

  /**
   * When an ErrorEndEvent is used, this will reate an error object with which
   * to end the process.
   * The process will not be finished regularly in this case.
   *
   * @param flowNode The FlowNode containing the termination definition
   * @param token    The current ProcessToken.
   */
  private _createErrorForEndEvent(flowNode: Model.Events.EndEvent): any {

    // Create customized error object, based on the error definition.
    const errorEventDefinition: Model.Types.Error = flowNode.errorEventDefinition.errorReference;
    const errorObject: {errorCode: string, name: string} = {
      errorCode: errorEventDefinition.errorCode,
      name: errorEventDefinition.name,
    };

    // Return the created Error object. Don't publish a success message here.
    return errorObject;
  }

  /**
   * Finishes a regular EndEvent, by simply publishing the corresponding notification.
   *
   * @param flowNode The EndEvent to process.
   * @param token    The current ProcessToken.
   */
  private _notifyAboutRegularEnd(flowNode: Model.Events.EndEvent, token: Runtime.Types.ProcessToken): void {

    // Publish regular success messsage.
    const processEndMessageName: string = eventAggregatorSettings.routePaths.endEventReached
      .replace(eventAggregatorSettings.routeParams.correlationId, token.correlationId)
      .replace(eventAggregatorSettings.routeParams.processModelId, token.processModelId);

    const message: EndEventReachedMessage = new EndEventReachedMessage(token.correlationId,
                                                                       token.processModelId,
                                                                       token.processInstanceId,
                                                                       flowNode.id,
                                                                       token.payload);
    this.eventAggregator.publish(processEndMessageName, message);

    // Send global message about a reached EndEvent
    this.eventAggregator.publish(eventAggregatorSettings.messagePaths.processEnded, message);
  }

}
