import {IEventAggregator} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';

import {IMetricsApi} from '@process-engine/metrics_api_contracts';
import {
  eventAggregatorSettings,
  EndEventReachedMessage,
  IFlowNodeInstanceService,
  IProcessModelFacade,
  IProcessTokenFacade,
  MessageEventReachedMessage,
  Model,
  NextFlowNodeInfo,
  ProcessEndedMessage,
  ProcessEndType,
  Runtime,
  SignalEventReachedMessage,
  TerminateEndEventReachedMessage,
} from '@process-engine/process_engine_contracts';

import {FlowNodeHandler} from './index';

export class EndEventHandler extends FlowNodeHandler<Model.Events.EndEvent> {

  private _eventAggregator: IEventAggregator;

  constructor(eventAggregator: IEventAggregator, flowNodeInstanceService: IFlowNodeInstanceService, metricsService: IMetricsApi) {
    super(flowNodeInstanceService, metricsService);
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

  private _sendProcessTerminatedToConsumerApi(correlationId: string,
                                              processInstanceId: string,
                                              flowNodeId: string,
                                              tokenPayload: any): void {
    const message: ProcessEndedMessage = new ProcessEndedMessage();
    message.correlationId = correlationId;
    message.processInstanceId = processInstanceId;
    message.flowNodeId = flowNodeId;
    message.tokenPayload = tokenPayload;
    message.endType = ProcessEndType.Terminated;

    this.eventAggregator.publish(eventAggregatorSettings.messagePaths.processTerminated, message);

    const processTerminatedEvent: string = eventAggregatorSettings.routePaths.processTerminated
      .replace(eventAggregatorSettings.routeParams.processInstanceId, processInstanceId);

    this.eventAggregator.publish(processTerminatedEvent, message);
  }

  private _sendProcessEndedToConsumerApi(correlationId: string,
                                         processInstanceId: string,
                                         flowNodeId: string,
                                         tokenPayload: any): void {
    const message: ProcessEndedMessage = new ProcessEndedMessage();
    message.correlationId = correlationId;
    message.processInstanceId = processInstanceId;
    message.flowNodeId = flowNodeId;
    message.tokenPayload = tokenPayload;
    message.endType = ProcessEndType.Ended;

    this.eventAggregator.publish(eventAggregatorSettings.messagePaths.processEnded, message);

    const processEndedEvent: string = eventAggregatorSettings.routePaths.processEnded
    .replace(eventAggregatorSettings.routeParams.processInstanceId, processInstanceId);
    this.eventAggregator.publish(processEndedEvent, message);
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
    const messageName: string = `/processengine/process/message/${flowNode.messageEventDefinition.messageRef}`;
    const payload: MessageEventReachedMessage = new MessageEventReachedMessage(flowNode.id, token.payload);
    this.eventAggregator.publish(messageName, payload);

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
    const messageName: string = `/processengine/process/signal/${flowNode.signalEventDefinition.signalRef}`;
    const payload: SignalEventReachedMessage = new SignalEventReachedMessage(flowNode.id, token.payload);
    this.eventAggregator.publish(messageName, payload);

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

    // Publish termination message to cancel all FlowNodeInstance executions and finish with an error.
    const event: string = `/processengine/process/${token.processInstanceId}/terminated`;
    const payload: TerminateEndEventReachedMessage = new TerminateEndEventReachedMessage(flowNode.id, token.payload);
    this.eventAggregator.publish(event, payload);
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
    const event: string = `/processengine/correlation/${token.correlationId}/process/${token.processModelId}/node/${flowNode.id}`;
    const payload: EndEventReachedMessage = new EndEventReachedMessage(flowNode.id, token.payload);
    this.eventAggregator.publish(event, payload);
  }

}
