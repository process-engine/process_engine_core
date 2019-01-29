import {IContainer} from 'addict-ioc';
import {Logger} from 'loggerhythm';

import {IEventAggregator} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';
import {
  EndEventReachedMessage,
  eventAggregatorSettings,
  IProcessModelFacade,
  IProcessTokenFacade,
  MessageEventReachedMessage,
  Model,
  Runtime,
  SignalEventReachedMessage,
  TerminateEndEventReachedMessage,
} from '@process-engine/process_engine_contracts';

import {FlowNodeHandler} from './index';

export class EndEventHandler extends FlowNodeHandler<Model.Events.EndEvent> {

  private _eventAggregator: IEventAggregator;

  constructor(container: IContainer, eventAggregator: IEventAggregator, endEventModel: Model.Events.EndEvent) {
    super(container, endEventModel);
    this._eventAggregator = eventAggregator;
    this.logger = new Logger(`processengine:end_event_handler:${endEventModel.id}`);
  }

  private get endEvent(): Model.Events.EndEvent {
    return super.flowNode;
  }

  protected async executeInternally(
    token: Runtime.Types.ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Model.Base.FlowNode> {

    this.logger.verbose(`Executing EndEvent instance ${this.flowNodeInstanceId}`);
    await this.persistOnEnter(token);

    return this._executeHandler(token, processTokenFacade, processModelFacade, identity);
  }

  protected async _executeHandler(
    token: Runtime.Types.ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Model.Base.FlowNode> {

    const flowNodeIsTerminateEndEvent: boolean = this.endEvent.terminateEventDefinition !== undefined;
    const flowNodeIsErrorEndEvent: boolean = this.endEvent.errorEventDefinition !== undefined;
    const flowNodeIsMessageEndEvent: boolean = this.endEvent.messageEventDefinition !== undefined;
    const flowNodeIsSignalEndEvent: boolean = this.endEvent.signalEventDefinition !== undefined;

    let errorObj: any;

    // Event persisting
    if (flowNodeIsTerminateEndEvent) {
      await this.persistOnTerminate(token);
    } else {
      await this.persistOnExit(token);
    }

    // Event notifications
    if (flowNodeIsTerminateEndEvent) {
      this._notifyAboutTermination(identity, token);
    } else if (flowNodeIsErrorEndEvent) {
      errorObj = this._createErrorForEndEvent();
    } else if (flowNodeIsMessageEndEvent) {
      this._sendMessage(identity, token);
    } else if (flowNodeIsSignalEndEvent) {
      this._sendSignal(identity, token);
    } else {
      this._notifyAboutRegularEnd(identity, token);
    }

    // Finalization
    if (flowNodeIsErrorEndEvent) {
      // ErrorEndEvents need to cause Promise rejection with the matching error object.
      return Promise.reject(errorObj);
    }

    return undefined;
  }

  /**
   * When a MessageEndEvent is used, an event with the corresponding message is
   * published to the EventAggregator.
   * Afterwards, the process finishes regularly.
   *
   * @param identity The identity that owns the EndEvent instance.
   * @param token    The current ProcessToken.
   */
  private _sendMessage(identity: IIdentity, token: Runtime.Types.ProcessToken): void {

    // Send message to processes that may be waiting for it.
    const messageName: string = this.endEvent.messageEventDefinition.name;

    const eventName: string = eventAggregatorSettings.messagePaths.messageEventReached
      .replace(eventAggregatorSettings.messageParams.messageReference, messageName);

    const message: MessageEventReachedMessage = new MessageEventReachedMessage(messageName,
                                                                               token.correlationId,
                                                                               token.processModelId,
                                                                               token.processInstanceId,
                                                                               this.endEvent.id,
                                                                               this.flowNodeInstanceId,
                                                                               identity,
                                                                               token.payload);
    this._eventAggregator.publish(eventName, message);

    this._notifyAboutRegularEnd(identity, token);
  }

  /**
   * When a SignalEndEvent is used, an event with the corresponding signal is
   * published to the EventAggregator.
   * Afterwards, the process finishes regularly.
   *
   * @param identity The identity that owns the EndEvent instance.
   * @param token    The current ProcessToken.
   */
  private _sendSignal(identity: IIdentity, token: Runtime.Types.ProcessToken): void {

    // Send message to processes that may be waiting for it.
    const signalName: string = this.endEvent.signalEventDefinition.name;

    const eventName: string = eventAggregatorSettings.messagePaths.signalEventReached
      .replace(eventAggregatorSettings.messageParams.signalReference, signalName);

    const message: SignalEventReachedMessage = new SignalEventReachedMessage(signalName,
                                                                             token.correlationId,
                                                                             token.processModelId,
                                                                             token.processInstanceId,
                                                                             this.endEvent.id,
                                                                             this.flowNodeInstanceId,
                                                                             identity,
                                                                             token.payload);
    this._eventAggregator.publish(eventName, message);

    this._notifyAboutRegularEnd(identity, token);
  }

  /**
   * When a TerminateEndEvent is used, an event with the corresponding
   * termination notification is published to the EventAggregator.
   *
   * @param identity The identity that owns the EndEvent instance.
   * @param token    The current ProcessToken.
   */
  private _notifyAboutTermination(identity: IIdentity, token: Runtime.Types.ProcessToken): void {

    // Publish termination message to cancel all FlowNodeInstance executions and
    // finish with an error.
    const eventName: string = eventAggregatorSettings.messagePaths.terminateEndEventReached
      .replace(eventAggregatorSettings.messageParams.processInstanceId, token.processInstanceId);

    const message: TerminateEndEventReachedMessage = new TerminateEndEventReachedMessage(token.correlationId,
                                                                                         token.processModelId,
                                                                                         token.processInstanceId,
                                                                                         this.endEvent.id,
                                                                                         this.flowNodeInstanceId,
                                                                                         identity,
                                                                                         token.payload);
    this._eventAggregator.publish(eventName, message);

    // Send global message about a reached TerminateEndEvent
    this._eventAggregator.publish(eventAggregatorSettings.messagePaths.processTerminated, message);
  }

  /**
   * When an ErrorEndEvent is used, this will reate an error object with which
   * to end the process.
   * The process will not be finished regularly in this case.
   *
   * @param identity The identity that owns the EndEvent instance.
   * @param token    The current ProcessToken.
   */
  private _createErrorForEndEvent(): any {

    // Create customized error object, based on the error definition.
    const errorEventDefinition: Model.Types.Error = this.endEvent.errorEventDefinition;
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
   * @param identity The identity that owns the EndEvent instance.
   * @param token    The current ProcessToken.
   */
  private _notifyAboutRegularEnd(identity: IIdentity, token: Runtime.Types.ProcessToken): void {

    // Publish regular success messsage.
    const processEndMessageName: string = eventAggregatorSettings.messagePaths.endEventReached
      .replace(eventAggregatorSettings.messageParams.correlationId, token.correlationId)
      .replace(eventAggregatorSettings.messageParams.processModelId, token.processModelId);

    const message: EndEventReachedMessage = new EndEventReachedMessage(token.correlationId,
                                                                       token.processModelId,
                                                                       token.processInstanceId,
                                                                       this.endEvent.id,
                                                                       this.flowNodeInstanceId,
                                                                       identity,
                                                                       token.payload);
    this._eventAggregator.publish(processEndMessageName, message);

    // Send global message about a reached EndEvent
    this._eventAggregator.publish(eventAggregatorSettings.messagePaths.processEnded, message);
  }
}
