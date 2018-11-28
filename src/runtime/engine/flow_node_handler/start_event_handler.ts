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

    function getFlowNodeInstanceTokenByType(tokenType: Runtime.Types.ProcessTokenType): Runtime.Types.ProcessToken {
      return flowNodeInstance.tokens.find((token: Runtime.Types.ProcessToken): boolean => {
        return token.type === tokenType;
      });
    }

    switch (flowNodeInstance.state) {
      case Runtime.Types.FlowNodeInstanceState.suspended:
        const suspendToken: Runtime.Types.ProcessToken = getFlowNodeInstanceTokenByType(Runtime.Types.ProcessTokenType.onSuspend);

        return this._continueAfterSuspend(flowNodeInstance, suspendToken, processTokenFacade, processModelFacade);
      case Runtime.Types.FlowNodeInstanceState.running:

        const resumeToken: Runtime.Types.ProcessToken = getFlowNodeInstanceTokenByType(Runtime.Types.ProcessTokenType.onResume);

        const startEventConditionNotYetAchieved: boolean = resumeToken === undefined;

        if (startEventConditionNotYetAchieved) {
          const onEnterToken: Runtime.Types.ProcessToken = getFlowNodeInstanceTokenByType(Runtime.Types.ProcessTokenType.onEnter);

          return this._continueAfterEnter(onEnterToken, processTokenFacade, processModelFacade);
        }

        return this._continueAfterResume(resumeToken, processTokenFacade, processModelFacade);
      case Runtime.Types.FlowNodeInstanceState.finished:
        const onExitToken: Runtime.Types.ProcessToken = getFlowNodeInstanceTokenByType(Runtime.Types.ProcessTokenType.onExit);

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

    // If the StartEvent is not a regular StartEvent,
    // wait for the defined condition to be fulfilled.
    if (flowNodeIsMessageStartEvent) {
      await this._waitForMessage(onSuspendToken, this.startEvent.messageEventDefinition.name);
    } else if (flowNodeIsSignalStartEvent) {
      await this._waitForSignal(onSuspendToken, this.startEvent.signalEventDefinition.name);
    } else if (flowNodeIsTimerStartEvent) {
      await this._waitForTimerToElapse(onSuspendToken, this.startEvent.timerEventDefinition);
    }

    const nextFlowNode: Model.Base.FlowNode = await processModelFacade.getNextFlowNodeFor(this.startEvent);
    await this.persistOnExit(onSuspendToken);

    return new NextFlowNodeInfo(nextFlowNode, onSuspendToken, processTokenFacade);
  }

  protected async _executeHandler(token: Runtime.Types.ProcessToken,
                                  processTokenFacade: IProcessTokenFacade,
                                  processModelFacade: IProcessModelFacade): Promise<NextFlowNodeInfo> {

    this._sendProcessStartedMessage(token, this.startEvent.id);

    const flowNodeIsMessageStartEvent: boolean = this.startEvent.messageEventDefinition !== undefined;
    const flowNodeIsSignalStartEvent: boolean = this.startEvent.signalEventDefinition !== undefined;
    const flowNodeIsTimerStartEvent: boolean = this.startEvent.timerEventDefinition !== undefined;

    // If the StartEvent is not a regular StartEvent,
    // wait for the defined condition to be fulfilled.
    if (flowNodeIsMessageStartEvent) {
      await this.persistOnSuspend(token);
      await this._waitForMessage(token, this.startEvent.messageEventDefinition.name);
    } else if (flowNodeIsSignalStartEvent) {
      await this.persistOnSuspend(token);
      await this._waitForSignal(token, this.startEvent.signalEventDefinition.name);
    } else if (flowNodeIsTimerStartEvent) {
      await this.persistOnSuspend(token);
      await this._waitForTimerToElapse(token, this.startEvent.timerEventDefinition);
    }

    const nextFlowNode: Model.Base.FlowNode = await processModelFacade.getNextFlowNodeFor(this.startEvent);

    await this.persistOnExit(token);

    return new NextFlowNodeInfo(nextFlowNode, token, processTokenFacade);
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
  /**
   * Creates a subscription on the EventAggregator and waits to receive the
   * designated message.
   *
   * @async
   * @param token       The current ProcessToken.
   * @param messageName The message to wait for.
   */
  private async _waitForMessage(token: Runtime.Types.ProcessToken, messageName: string): Promise<void> {

    return new Promise<void>((async(resolve: Function): Promise<void> => {

      const messageEventName: string = eventAggregatorSettings.routePaths.messageEventReached
        .replace(eventAggregatorSettings.routeParams.messageReference, messageName);

      const subscription: ISubscription = this._eventAggregator.subscribeOnce(messageEventName, async(message: MessageEventReachedMessage) => {

        if (subscription) {
          subscription.dispose();
        }

        await this.persistOnResume(token);

        resolve();
      });

      await this.persistOnSuspend(token);
    }));
  }

  /**
   * Creates a subscription on the EventAggregator and waits to receive the
   * designated signal.
   *
   * @async
   * @param token      The current ProcessToken.
   * @param signalName The signal to wait for.
   */
  private async _waitForSignal(token: Runtime.Types.ProcessToken, signalName: string): Promise<void> {

    return new Promise<void>(async(resolve: Function): Promise<void> => {

      const signalEventName: string = eventAggregatorSettings.routePaths.signalEventReached
        .replace(eventAggregatorSettings.routeParams.signalReference, signalName);

      const subscription: ISubscription = this._eventAggregator.subscribeOnce(signalEventName, async(message: SignalEventReachedMessage) => {

        if (subscription) {
          subscription.dispose();
        }

        await this.persistOnResume(token);

        resolve();
      });

      await this.persistOnSuspend(token);
    });
  }

  /**
   * If a timed StartEvent is used, this will delay the events execution
   * until the timer has elapsed.
   *
   * @async
   * @param token           The current ProcessToken.
   * @param timerDefinition The definition that contains the timer to use.
   */
  private async _waitForTimerToElapse(token: Runtime.Types.ProcessToken,
                                      timerDefinition: Model.EventDefinitions.TimerEventDefinition): Promise<void> {

    return new Promise<void> (async(resolve: Function, reject: Function): Promise<void> => {

      let timerSubscription: ISubscription;

      const timerType: TimerDefinitionType = this._timerFacade.parseTimerDefinitionType(timerDefinition);
      const timerValue: string = this._timerFacade.parseTimerDefinitionValue(timerDefinition);

      const timerElapsed: any = async(): Promise<void> => {

        await this.persistOnResume(token);

        const cancelSubscription: boolean = timerSubscription && timerType !== TimerDefinitionType.cycle;

        if (cancelSubscription) {
          timerSubscription.dispose();
        }

        resolve();
      };

      timerSubscription = this._timerFacade.initializeTimer(this.startEvent, timerType, timerValue, timerElapsed);
      await this.persistOnSuspend(token);
    });
  }
}
