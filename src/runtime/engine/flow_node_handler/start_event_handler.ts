import {InternalServerError} from '@essential-projects/errors_ts';
import {IEventAggregator, ISubscription} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';

import {ILoggingApi} from '@process-engine/logging_api_contracts';
import {IMetricsApi} from '@process-engine/metrics_api_contracts';
import {
  eventAggregatorSettings,
  IFlowNodeInstanceService,
  IProcessModelFacade,
  IProcessTokenFacade,
  ITimerFacade,
  MessageEventReachedMessage,
  Model,
  NextFlowNodeInfo,
  ProcessStartedMessage,
  Runtime,
  SignalEventReachedMessage,
  TimerDefinitionType,
} from '@process-engine/process_engine_contracts';

import {FlowNodeHandler} from './index';

export class StartEventHandler extends FlowNodeHandler<Model.Events.StartEvent> {

  private _eventAggregator: IEventAggregator;
  private _timerFacade: ITimerFacade;

  constructor(eventAggregator: IEventAggregator,
              flowNodeInstanceService: IFlowNodeInstanceService,
              loggingApiService: ILoggingApi,
              metricsService: IMetricsApi,
              timerFacade: ITimerFacade,
              startEventModel: Model.Events.StartEvent) {
    super(flowNodeInstanceService, loggingApiService, metricsService, startEventModel);
    this._eventAggregator = eventAggregator;
    this._timerFacade = timerFacade;
  }

  private get startEvent(): Model.Events.StartEvent {
    return super.flowNode;
  }

  protected async executeInternally(token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    identity: IIdentity): Promise<NextFlowNodeInfo> {

    await this.persistOnEnter(token);

    return this._executeHandler(token, processTokenFacade, processModelFacade);
  }

  protected async resumeInternally(flowNodeInstance: Runtime.Types.FlowNodeInstance,
                                   processTokenFacade: IProcessTokenFacade,
                                   processModelFacade: IProcessModelFacade,
                                   identity: IIdentity,
                                 ): Promise<NextFlowNodeInfo> {

    switch (flowNodeInstance.state) {
      case Runtime.Types.FlowNodeInstanceState.suspended:
        const suspendToken: Runtime.Types.ProcessToken = flowNodeInstance.getTokenByType(Runtime.Types.ProcessTokenType.onSuspend);

        return this._continueAfterSuspend(flowNodeInstance, suspendToken, processTokenFacade, processModelFacade);
      case Runtime.Types.FlowNodeInstanceState.running:

        const resumeToken: Runtime.Types.ProcessToken = flowNodeInstance.getTokenByType(Runtime.Types.ProcessTokenType.onResume);

        const startEventConditionNotYetAchieved: boolean = resumeToken === undefined;

        if (startEventConditionNotYetAchieved) {
          const onEnterToken: Runtime.Types.ProcessToken = flowNodeInstance.getTokenByType(Runtime.Types.ProcessTokenType.onEnter);

          return this._continueAfterEnter(onEnterToken, processTokenFacade, processModelFacade);
        }

        return this._continueAfterResume(resumeToken, processTokenFacade, processModelFacade);
      case Runtime.Types.FlowNodeInstanceState.finished:
        const onExitToken: Runtime.Types.ProcessToken = flowNodeInstance.getTokenByType(Runtime.Types.ProcessTokenType.onExit);

        return this._continueAfterExit(onExitToken, processTokenFacade, processModelFacade);
      case Runtime.Types.FlowNodeInstanceState.error:
        throw flowNodeInstance.error;
      case Runtime.Types.FlowNodeInstanceState.terminated:
        throw new InternalServerError(`Cannot resume StartEvent instance ${flowNodeInstance.id}, because it was terminated!`);
      default:
        throw new InternalServerError(`Cannot resume StartEvent instance ${flowNodeInstance.id}, because its state cannot be determined!`);
    }
  }

  protected async _continueAfterSuspend(flowNodeInstance: Runtime.Types.FlowNodeInstance,
                                        onSuspendToken: Runtime.Types.ProcessToken,
                                        processTokenFacade: IProcessTokenFacade,
                                        processModelFacade: IProcessModelFacade,
                                      ): Promise<NextFlowNodeInfo> {

    const flowNodeIsMessageStartEvent: boolean = this.startEvent.messageEventDefinition !== undefined;
    const flowNodeIsSignalStartEvent: boolean = this.startEvent.signalEventDefinition !== undefined;
    const flowNodeIsTimerStartEvent: boolean = this.startEvent.timerEventDefinition !== undefined;

    const isSpecializedStartEvent: boolean = flowNodeIsMessageStartEvent || flowNodeIsSignalStartEvent || flowNodeIsTimerStartEvent;

    // If the StartEvent is not a regular StartEvent,
    // wait for the defined condition to be fulfilled.
    if (isSpecializedStartEvent) {

      let newTokenPayload: any =
        await new Promise<any>(async(resolve: Function, reject: Function): Promise<void> => {
          if (flowNodeIsMessageStartEvent) {
            newTokenPayload = this._waitForMessage(onSuspendToken, resolve);
          } else if (flowNodeIsSignalStartEvent) {
            newTokenPayload = this._waitForSignal(onSuspendToken, resolve);
          } else if (flowNodeIsTimerStartEvent) {
            newTokenPayload = this._waitForTimerToElapse(onSuspendToken, resolve);
          }
        });

      onSuspendToken.payload = newTokenPayload;
      await this.persistOnResume(onSuspendToken);
    }

    processTokenFacade.addResultForFlowNode(this.startEvent.id, onSuspendToken.payload);
    await this.persistOnExit(onSuspendToken);

    return this.getNextFlowNodeInfo(onSuspendToken, processTokenFacade, processModelFacade);
  }

  protected async _executeHandler(token: Runtime.Types.ProcessToken,
                                  processTokenFacade: IProcessTokenFacade,
                                  processModelFacade: IProcessModelFacade): Promise<NextFlowNodeInfo> {

    this._sendProcessStartedMessage(token, this.startEvent.id);

    const flowNodeIsMessageStartEvent: boolean = this.startEvent.messageEventDefinition !== undefined;
    const flowNodeIsSignalStartEvent: boolean = this.startEvent.signalEventDefinition !== undefined;
    const flowNodeIsTimerStartEvent: boolean = this.startEvent.timerEventDefinition !== undefined;

    const isSpecializedStartEvent: boolean = flowNodeIsMessageStartEvent || flowNodeIsSignalStartEvent || flowNodeIsTimerStartEvent;

    // If the StartEvent is not a regular StartEvent,
    // wait for the defined condition to be fulfilled.
    if (isSpecializedStartEvent) {

      let newTokenPayload: any = token.payload;

      if (flowNodeIsMessageStartEvent) {
        newTokenPayload = await this._suspendAndWaitForMessage(token);
      } else if (flowNodeIsSignalStartEvent) {
        newTokenPayload = await this._suspendAndWaitForSignal(token);
      } else if (flowNodeIsTimerStartEvent) {
        newTokenPayload = await this._suspendAndWaitForTimerToElapse(token);
      }

      token.payload = newTokenPayload;
      await this.persistOnResume(token);
    }

    processTokenFacade.addResultForFlowNode(this.startEvent.id, token.payload);
    await this.persistOnExit(token);

    return this.getNextFlowNodeInfo(token, processTokenFacade, processModelFacade);
  }

  /**
   * Sends a message that the ProcessInstance was started.
   *
   * @param token Current token object, which contains all necessary Process Metadata.
   * @param startEventId Id of the used StartEvent.
   */
  private _sendProcessStartedMessage(token: Runtime.Types.ProcessToken, startEventId: string): void {
    const processStartedMessage: ProcessStartedMessage = new ProcessStartedMessage(token.correlationId,
      token.processModelId,
      token.processInstanceId,
      startEventId,
      token.payload);

    this._eventAggregator.publish(eventAggregatorSettings.messagePaths.processStarted, processStartedMessage);

    const processStartedBaseName: string = eventAggregatorSettings.routePaths.processInstanceStarted;
    const processModelIdParam: string = eventAggregatorSettings.routeParams.processModelId;
    const processWithIdStartedMessage: string =
      processStartedBaseName
        .replace(processModelIdParam, token.processModelId);

    this._eventAggregator.publish(processWithIdStartedMessage, processStartedMessage);
  }

  private async _suspendAndWaitForMessage(currentToken: Runtime.Types.ProcessToken): Promise<any> {
    return new Promise<any>(async(resolve: Function, reject: Function): Promise<void> => {
      this._waitForMessage(currentToken, resolve);
      await this.persistOnSuspend(currentToken);
    });
  }

  private async _suspendAndWaitForSignal(currentToken: Runtime.Types.ProcessToken): Promise<any> {
    return new Promise<any>(async(resolve: Function, reject: Function): Promise<void> => {
      this._waitForSignal(currentToken, resolve);
      await this.persistOnSuspend(currentToken);
    });
  }

  private async _suspendAndWaitForTimerToElapse(currentToken: Runtime.Types.ProcessToken): Promise<any> {
    return new Promise<any>(async(resolve: Function, reject: Function): Promise<void> => {
      this._waitForTimerToElapse(currentToken, resolve);
      await this.persistOnSuspend(currentToken);
    });
  }

  /**
   * Creates a subscription on the EventAggregator and waits to receive the
   * message described in the StartEvents event definition.
   *
   * @param currentToken The current ProcessToken.
   * @param resolveFunc  The function to call after the message was received.
   */
  private _waitForMessage(currentToken: Runtime.Types.ProcessToken, resolveFunc: Function): void {

    const messageDefinitionName: string = this.startEvent.messageEventDefinition.name;

    const messageEventName: string = eventAggregatorSettings.routePaths.messageEventReached
      .replace(eventAggregatorSettings.routeParams.messageReference, messageDefinitionName);

    const subscription: ISubscription =
      this._eventAggregator.subscribeOnce(messageEventName, (messageEventPayload: MessageEventReachedMessage) => {

        if (subscription) {
          subscription.dispose();
        }

        const messageHasPayload: boolean = this._checkIfEventPayloadHasToken(messageEventPayload);
        const tokenToReturn: any = messageHasPayload
          ? messageEventPayload.currentToken
          : currentToken.payload;

        resolveFunc(tokenToReturn);
      });
  }

  /**
   * Creates a subscription on the EventAggregator and waits to receive the
   * signal described in the StartEvents event definition.
   *
   * @param currentToken The current ProcessToken.
   * @param resolveFunc  The function to call after the signal was received.
   */
  private _waitForSignal(currentToken: Runtime.Types.ProcessToken, resolveFunc: Function): void {

    const signalDefinitionName: string = this.startEvent.signalEventDefinition.name;

    const signalEventName: string = eventAggregatorSettings.routePaths.signalEventReached
      .replace(eventAggregatorSettings.routeParams.signalReference, signalDefinitionName);

    const subscription: ISubscription =
      this._eventAggregator.subscribeOnce(signalEventName, (signalEventPayload: SignalEventReachedMessage) => {

        if (subscription) {
          subscription.dispose();
        }

        const signalHasPayload: boolean = this._checkIfEventPayloadHasToken(signalEventPayload);
        const tokenToReturn: any = signalHasPayload
          ? signalEventPayload.currentToken
          : currentToken.payload;

        resolveFunc(tokenToReturn);
      });
  }

  /**
   * If a timed StartEvent is used, this will delay the events execution
   * until the timer has elapsed.
   *
   * @param currentToken The current ProcessToken.
   * @param resolveFunc  The function to call after the timer has elapsed.
   */
  private _waitForTimerToElapse(currentToken: Runtime.Types.ProcessToken, resolveFunc: Function): void {

    const timerDefinition: Model.EventDefinitions.TimerEventDefinition = this.startEvent.timerEventDefinition;

    let timerSubscription: ISubscription;

    const timerType: TimerDefinitionType = this._timerFacade.parseTimerDefinitionType(timerDefinition);
    const timerValue: string = this._timerFacade.parseTimerDefinitionValue(timerDefinition);

    const timerElapsed: any = (): void => {

      const cancelSubscription: boolean = timerSubscription && timerType !== TimerDefinitionType.cycle;

      if (cancelSubscription) {
        timerSubscription.dispose();
      }

      resolveFunc(currentToken.payload);
    };

    timerSubscription = this._timerFacade.initializeTimer(this.startEvent, timerType, timerValue, timerElapsed);
  }

  /**
   * Checks if the given message has a valid payload.
   * This function serves to prevent initial tokens to be accidentally wiped
   * by an empty message.
   *
   * @param   message The message for which to check the payload.
   * @returns         'true', if a valid payload was send with the message,
   *                  'false' otherwise.
   */
  private _checkIfEventPayloadHasToken(message: SignalEventReachedMessage | MessageEventReachedMessage): boolean {

    const messageHasNoPayload: boolean = !message || !message.currentToken;
    if (messageHasNoPayload) {
      return false;
    }

    const payloadIsEmptyArray: boolean = Array.isArray(message.currentToken) && message.currentToken.length === 0;
    if (payloadIsEmptyArray) {
      return false;
    }

    const payloadIsEmptyObject: boolean = typeof message.currentToken === 'object' &&
                                          Object.keys(message.currentToken).length === 0;
    if (payloadIsEmptyObject) {
      return false;
    }

    const payloadIsEmptyString: boolean = typeof message.currentToken === 'string' && message.currentToken.length === 0;
    if (payloadIsEmptyString) {
      return false;
    }

    return true;
  }
}
