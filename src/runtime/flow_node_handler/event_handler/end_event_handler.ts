import {Logger} from 'loggerhythm';

import {InternalServerError} from '@essential-projects/errors_ts';
import {IEventAggregator} from '@essential-projects/event_aggregator_contracts';
import {IIAMService, IIdentity} from '@essential-projects/iam_contracts';

import {ProcessToken} from '@process-engine/flow_node_instance.contracts';
import {
  BpmnError,
  EndEventReachedMessage,
  ErrorEndEventReachedMessage,
  IFlowNodeHandlerFactory,
  IFlowNodePersistenceFacade,
  IProcessModelFacade,
  IProcessTokenFacade,
  MessageEventReachedMessage,
  SignalEventReachedMessage,
  TerminateEndEventReachedMessage,
  eventAggregatorSettings,
} from '@process-engine/process_engine_contracts';
import {Model} from '@process-engine/process_model.contracts';

import {EventHandler} from './index';

export class EndEventHandler extends EventHandler<Model.Events.EndEvent> {

  private readonly iamService: IIAMService;

  constructor(
    eventAggregator: IEventAggregator,
    flowNodeHandlerFactory: IFlowNodeHandlerFactory,
    flowNodePersistenceFacade: IFlowNodePersistenceFacade,
    iamService: IIAMService,
    endEventModel: Model.Events.EndEvent,
  ) {
    super(eventAggregator, flowNodeHandlerFactory, flowNodePersistenceFacade, endEventModel);
    this.logger = new Logger(`processengine:end_event_handler:${endEventModel.id}`);
    this.iamService = iamService;
  }

  private get endEvent(): Model.Events.EndEvent {
    return this.flowNode;
  }

  // Overriding this hook here prevents it from creating subscriptions for
  // ProcessTermination, which we neither need nor want for EndEvents.
  protected async beforeExecute(
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<void> {
    return Promise.resolve();
  }

  protected async executeInternally(
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    this.logger.verbose(`Executing EndEvent instance ${this.flowNodeInstanceId}`);
    await this.persistOnEnter(token);

    return this.executeHandler(token, processTokenFacade, processModelFacade, identity);
  }

  protected async executeHandler(
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    return new Promise<any>(async (resolve: Function, reject: Function): Promise<void> => {
      const flowNodeIsTerminateEndEvent = this.endEvent.terminateEventDefinition !== undefined;
      const flowNodeIsErrorEndEvent = this.endEvent.errorEventDefinition !== undefined;
      const flowNodeIsMessageEndEvent = this.endEvent.messageEventDefinition !== undefined;
      const flowNodeIsSignalEndEvent = this.endEvent.signalEventDefinition !== undefined;

      try {
        let errorObj: BpmnError;

        const claimCheckNeeded = flowNodeIsMessageEndEvent || flowNodeIsSignalEndEvent;
        if (claimCheckNeeded) {
          await this.ensureHasClaim(identity, processModelFacade);
        }

        token.payload = this.getFinalTokenPayloadFromInputValues(token, processTokenFacade, identity);

        // Event persisting
        if (flowNodeIsTerminateEndEvent) {
          await this.persistOnTerminate(token);
        } else {
          await this.persistOnExit(token);
        }

        // Event notifications
        if (flowNodeIsTerminateEndEvent) {
          this.notifyAboutTermination(identity, token);
        } else if (flowNodeIsErrorEndEvent) {
          errorObj = this.createBpmnError();
        } else if (flowNodeIsMessageEndEvent) {
          this.sendMessage(identity, token);
        } else if (flowNodeIsSignalEndEvent) {
          this.sendSignal(identity, token);
        } else {
          this.notifyAboutRegularEnd(identity, token);
        }

        // Finalization
        if (flowNodeIsErrorEndEvent) {
          this.notifyAboutError(identity, token, errorObj);

          return reject(errorObj);
        }

        // EndEvents have no follow-up FlowNodes, so we must return nothing here.
        return resolve(undefined);
      } catch (error) {
        this.logger.error(`Failed to run EndEvent: ${error.message}`);

        token.payload = {};

        this.persistOnError(token, error);

        return reject(error);
      }
    });
  }

  private async ensureHasClaim(identity: IIdentity, processModelFacade: IProcessModelFacade): Promise<void> {

    const processModelHasNoLanes = !processModelFacade.getProcessModelHasLanes();
    if (processModelHasNoLanes) {
      return;
    }

    const laneForFlowNode = processModelFacade.getLaneForFlowNode(this.flowNode.id);
    const claimName = laneForFlowNode.name;

    await this.iamService.ensureHasClaim(identity, claimName);
  }

  /**
   * Retrives the payload to use with the event.
   *
   * This will either be expression contained in the `inputValues` property
   * of the FlowNode, if it exists, or the current token.
   *
   * @param   token              The current ProcessToken.
   * @param   processTokenFacade The facade for handling all ProcessTokens.
   * @param   identity           The requesting users identity.
   * @returns                    The retrieved payload for the event.
   */
  private getFinalTokenPayloadFromInputValues(token: ProcessToken, processTokenFacade: IProcessTokenFacade, identity: IIdentity): any {

    try {
      const eventUsesDefaultPayload = this.endEvent.inputValues === undefined;

      if (eventUsesDefaultPayload) {
        return token.payload;
      }

      const tokenHistory = processTokenFacade.getOldTokenFormat();

      const evaluatePayloadFunction = new Function('token', 'identity', `return ${this.endEvent.inputValues}`);

      return evaluatePayloadFunction.call(tokenHistory, tokenHistory, identity);
    } catch (error) {
      const errorMessage = `EndEvent configuration for inputValues '${this.endEvent.inputValues}' is invalid!`;
      this.logger.error(errorMessage);

      throw new InternalServerError(errorMessage);
    }
  }

  /**
   * When an ErrorEndEvent is used, this will reate an error object with which
   * to end the process.
   * The process will not be finished regularly in this case.
   */
  private createBpmnError(): BpmnError {
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
  private sendMessage(identity: IIdentity, token: ProcessToken): void {

    const messageName = this.endEvent.messageEventDefinition.name;

    const eventName = eventAggregatorSettings.messagePaths.messageEventReached
      .replace(eventAggregatorSettings.messageParams.messageReference, messageName);

    const message = new MessageEventReachedMessage(
      messageName,
      token.correlationId,
      token.processModelId,
      token.processInstanceId,
      this.endEvent.id,
      this.flowNodeInstanceId,
      identity,
      token.payload,
      this.endEvent.name,
    );

    // Message-specific notification
    this.eventAggregator.publish(eventName, message);
    // General message notification
    this.eventAggregator.publish(eventAggregatorSettings.messagePaths.messageTriggered, message);

    this.notifyAboutRegularEnd(identity, token);
  }

  /**
   * When a SignalEndEvent is used, an event with the corresponding signal is
   * published to the EventAggregator.
   * Afterwards, the process finishes regularly.
   *
   * @param identity The identity that owns the EndEvent instance.
   * @param token    The current ProcessToken.
   */
  private sendSignal(identity: IIdentity, token: ProcessToken): void {

    const signalName = this.endEvent.signalEventDefinition.name;

    const eventName = eventAggregatorSettings.messagePaths.signalEventReached
      .replace(eventAggregatorSettings.messageParams.signalReference, signalName);

    const message = new SignalEventReachedMessage(
      signalName,
      token.correlationId,
      token.processModelId,
      token.processInstanceId,
      this.endEvent.id,
      this.flowNodeInstanceId,
      identity,
      token.payload,
      this.endEvent.name,
    );

    // Signal-specific notification
    this.eventAggregator.publish(eventName, message);
    // General signal notification
    this.eventAggregator.publish(eventAggregatorSettings.messagePaths.signalTriggered, message);

    this.notifyAboutRegularEnd(identity, token);
  }

  /**
   * When an ErrorEndEvent is used, an event with the corresponding
   * error notification is published to the EventAggregator.
   *
   * @param identity The identity that owns the EndEvent instance.
   * @param token    The current ProcessToken.
   */
  private notifyAboutError(identity: IIdentity, token: ProcessToken, error: Error): void {

    // Publish termination message to cancel all FlowNodeInstance executions and
    // finish with an error.
    const eventName = eventAggregatorSettings.messagePaths.processInstanceWithIdErrored
      .replace(eventAggregatorSettings.messageParams.processInstanceId, token.processInstanceId);

    const message = new ErrorEndEventReachedMessage(
      token.correlationId,
      token.processModelId,
      token.processInstanceId,
      this.endEvent.id,
      this.flowNodeInstanceId,
      identity,
      token.payload,
      error,
      this.endEvent.name,
    );

    // ProcessInstance specific notification
    this.eventAggregator.publish(eventName, message);
    // Global notification
    this.eventAggregator.publish(eventAggregatorSettings.messagePaths.processError, message);
  }

  /**
   * When a TerminateEndEvent is used, an event with the corresponding
   * termination notification is published to the EventAggregator.
   *
   * @param identity The identity that owns the EndEvent instance.
   * @param token    The current ProcessToken.
   */
  private notifyAboutTermination(identity: IIdentity, token: ProcessToken): void {

    // Publish termination message to cancel all FlowNodeInstance executions and
    // finish with an error.
    const eventName = eventAggregatorSettings.messagePaths.processInstanceWithIdTerminated
      .replace(eventAggregatorSettings.messageParams.processInstanceId, token.processInstanceId);

    const message = new TerminateEndEventReachedMessage(
      token.correlationId,
      token.processModelId,
      token.processInstanceId,
      this.endEvent.id,
      this.flowNodeInstanceId,
      identity,
      token.payload,
      this.endEvent.name,
    );

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
  private notifyAboutRegularEnd(identity: IIdentity, token: ProcessToken): void {

    // Publish regular success messsage.
    const processEndMessageName = eventAggregatorSettings.messagePaths.endEventReached
      .replace(eventAggregatorSettings.messageParams.correlationId, token.correlationId)
      .replace(eventAggregatorSettings.messageParams.processModelId, token.processModelId);

    const message = new EndEventReachedMessage(
      token.correlationId,
      token.processModelId,
      token.processInstanceId,
      this.endEvent.id,
      this.flowNodeInstanceId,
      identity,
      token.payload,
      this.endEvent.name,
    );

    // ProcessInstance specific notification
    this.eventAggregator.publish(processEndMessageName, message);
    // Global notification
    this.eventAggregator.publish(eventAggregatorSettings.messagePaths.processEnded, message);
  }

}
