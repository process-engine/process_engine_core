import {Logger} from 'loggerhythm';

import {IEventAggregator} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';

import {ProcessToken} from '@process-engine/flow_node_instance.contracts';
import {
  BpmnError,
  EndEventReachedMessage,
  eventAggregatorSettings,
  IFlowNodeHandlerFactory,
  IFlowNodePersistenceFacade,
  IProcessModelFacade,
  IProcessTokenFacade,
  MessageEventReachedMessage,
  SignalEventReachedMessage,
  TerminateEndEventReachedMessage,
} from '@process-engine/process_engine_contracts';
import {Model} from '@process-engine/process_model.contracts';

import {FlowNodeHandler} from './index';

export class EndEventHandler extends FlowNodeHandler<Model.Events.EndEvent> {

  constructor(
    eventAggregator: IEventAggregator,
    flowNodeHandlerFactory: IFlowNodeHandlerFactory,
    flowNodePersistenceFacade: IFlowNodePersistenceFacade,
    endEventModel: Model.Events.EndEvent,
  ) {
    super(eventAggregator, flowNodeHandlerFactory, flowNodePersistenceFacade, endEventModel);
    this.logger = new Logger(`processengine:end_event_handler:${endEventModel.id}`);
  }

  private get endEvent(): Model.Events.EndEvent {
    return super.flowNode;
  }

  protected async executeInternally(
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    this.logger.verbose(`Executing EndEvent instance ${this.flowNodeInstanceId}`);
    await this.persistOnEnter(token);

    return this._executeHandler(token, processTokenFacade, processModelFacade, identity);
  }

  protected async _executeHandler(
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    return new Promise<any>(async(resolve: Function, reject: Function): Promise<void> => {
      const flowNodeIsTerminateEndEvent: boolean = this.endEvent.terminateEventDefinition !== undefined;
      const flowNodeIsErrorEndEvent: boolean = this.endEvent.errorEventDefinition !== undefined;
      const flowNodeIsMessageEndEvent: boolean = this.endEvent.messageEventDefinition !== undefined;
      const flowNodeIsSignalEndEvent: boolean = this.endEvent.signalEventDefinition !== undefined;

      let errorObj: BpmnError;

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
        errorObj = this._createBpmnError();
      } else if (flowNodeIsMessageEndEvent) {
        this._sendMessage(identity, token);
      } else if (flowNodeIsSignalEndEvent) {
        this._sendSignal(identity, token);
      } else {
        this._notifyAboutRegularEnd(identity, token);
      }

      // Finalization
      if (flowNodeIsErrorEndEvent) {
        return reject(errorObj);
      }

      // EndEvents have no follow-up FlowNodes, so we must return nothing here.
      return resolve(undefined);
    });
  }

  /**
   * When an ErrorEndEvent is used, this will reate an error object with which
   * to end the process.
   * The process will not be finished regularly in this case.
   *
   * @param identity The identity that owns the EndEvent instance.
   * @param token    The current ProcessToken.
   */
  private _createBpmnError(): BpmnError {
    return new BpmnError(this.endEvent.errorEventDefinition.name, this.endEvent.errorEventDefinition.code);
  }

  /**
   * When a MessageEndEvent is used, an event with the corresponding message is
   * published to the EventAggregator.
   * Afterwards, the process finishes regularly.
   *
   * @param identity The identity that owns the EndEvent instance.
   * @param token    The current ProcessToken.
   */
  private _sendMessage(identity: IIdentity, token: ProcessToken): void {

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
                                                                               token.payload,
                                                                               this.endEvent.name);
    // Message-specific notification
    this.eventAggregator.publish(eventName, message);
    // General message notification
    this.eventAggregator.publish(eventAggregatorSettings.messagePaths.messageTriggered, message);

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
  private _sendSignal(identity: IIdentity, token: ProcessToken): void {

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
                                                                             token.payload,
                                                                             this.endEvent.name);
    // Signal-specific notification
    this.eventAggregator.publish(eventName, message);
    // General signal notification
    this.eventAggregator.publish(eventAggregatorSettings.messagePaths.signalTriggered, message);

    this._notifyAboutRegularEnd(identity, token);
  }

  /**
   * When a TerminateEndEvent is used, an event with the corresponding
   * termination notification is published to the EventAggregator.
   *
   * @param identity The identity that owns the EndEvent instance.
   * @param token    The current ProcessToken.
   */
  private _notifyAboutTermination(identity: IIdentity, token: ProcessToken): void {

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
                                                                                         token.payload,
                                                                                         this.endEvent.name);
    // ProcessInstance specific notification
    this.eventAggregator.publish(eventName, message);
    // Global notification
    this.eventAggregator.publish(eventAggregatorSettings.messagePaths.processTerminated, message);
  }

  /**
   * Finishes a regular EndEvent, by simply publishing the corresponding notification.
   *
   * @param identity The identity that owns the EndEvent instance.
   * @param token    The current ProcessToken.
   */
  private _notifyAboutRegularEnd(identity: IIdentity, token: ProcessToken): void {

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
                                                                       token.payload,
                                                                       this.endEvent.name);
    // ProcessInstance specific notification
    this.eventAggregator.publish(processEndMessageName, message);
    // Global notification
    this.eventAggregator.publish(eventAggregatorSettings.messagePaths.processEnded, message);
  }
}
