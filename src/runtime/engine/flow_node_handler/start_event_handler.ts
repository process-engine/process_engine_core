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

  public async resumeInternally(flowNodeInstance: Runtime.Types.FlowNodeInstance,
                                processTokenFacade: IProcessTokenFacade,
                                processModelFacade: IProcessModelFacade,
                                identity: IIdentity,
                              ): Promise<NextFlowNodeInfo> {

    switch (flowNodeInstance.state) {
      case Runtime.Types.FlowNodeInstanceState.suspended:
        return this._continueAfterSuspend(flowNodeInstance, processTokenFacade, processModelFacade);
      case Runtime.Types.FlowNodeInstanceState.running:

        const resumeToken: Runtime.Types.ProcessToken =
          flowNodeInstance.tokens.find((token: Runtime.Types.ProcessToken): boolean => {
            return token.type === Runtime.Types.ProcessTokenType.onResume;
          });

        const startEventConditionNotYetAchieved: boolean = resumeToken === undefined;

        if (startEventConditionNotYetAchieved) {
          return this._continueAfterEnter(flowNodeInstance, processTokenFacade, processModelFacade);
        }

        return this._continueAfterResume(resumeToken, processTokenFacade, processModelFacade);
      default:
        throw new InternalServerError(`Cannot resume StartEvent instance ${flowNodeInstance.id}, because it was already finished!`);
    }
  }

  /**
   * Resumes the given FlowNodeInstance from the point where it assumed the
   * "onEnter" state.
   *
   * Basically, the handler was not yet executed, except for the initial
   * state change.
   *
   * @async
   * @param   flowNodeInstance   The FlowNodeInstance to resume.
   * @param   processTokenFacade The ProcessTokenFacade to use for resuming.
   * @param   processModelFacade The processModelFacade to use for resuming.
   * @returns                    The Info for the next FlowNode to run.
   */
  private async _continueAfterEnter(flowNodeInstance: Runtime.Types.FlowNodeInstance,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                   ): Promise<NextFlowNodeInfo> {

    // When the FNI was interrupted directly after the onEnter state change, only one token will be present.
    const onEnterToken: Runtime.Types.ProcessToken = flowNodeInstance.tokens[0];

    return this._executeHandler(onEnterToken, processTokenFacade, processModelFacade);
  }

  /**
   * Resumes the given FlowNodeInstance from the point where it assumed the
   * "onSuspended" state.
   *
   * When the FlowNodeInstance was interrupted during this stage, we need to
   * run the handler again, except for the "onSuspend" state change.
   *
   * @async
   * @param   flowNodeInstance   The FlowNodeInstance to resume.
   * @param   processTokenFacade The ProcessTokenFacade to use for resuming.
   * @param   processModelFacade The processModelFacade to use for resuming.
   * @returns                    The Info for the next FlowNode to run.
   */
  private async _continueAfterSuspend(flowNodeInstance: Runtime.Types.FlowNodeInstance,
                                      processTokenFacade: IProcessTokenFacade,
                                      processModelFacade: IProcessModelFacade,
                                     ): Promise<NextFlowNodeInfo> {

    const onSuspendToken: Runtime.Types.ProcessToken =
      flowNodeInstance.tokens.find((token: Runtime.Types.ProcessToken): boolean => {
        return token.type === Runtime.Types.ProcessTokenType.onSuspend;
      });

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

  /**
   * Resumes the given FlowNodeInstance from the point where it assumed the
   * "onResumed" state.
   *
   * Basically, the StartEvent was already finished.
   * The final result is only missing in the database.
   *
   * @async
   * @param   resumeToken   The FlowNodeInstance to resume.
   * @param   processTokenFacade The ProcessTokenFacade to use for resuming.
   * @param   processModelFacade The processModelFacade to use for resuming.
   * @returns                    The Info for the next FlowNode to run.
   */
  private async _continueAfterResume(resumeToken: Runtime.Types.ProcessToken,
                                     processTokenFacade: IProcessTokenFacade,
                                     processModelFacade: IProcessModelFacade,
                                    ): Promise<NextFlowNodeInfo> {

    processTokenFacade.addResultForFlowNode(this.startEvent.id, resumeToken.payload);

    const nextNodeAfter: Model.Base.FlowNode = processModelFacade.getNextFlowNodeFor(this.startEvent);

    await this.persistOnExit(resumeToken);

    return new NextFlowNodeInfo(nextNodeAfter, resumeToken, processTokenFacade);
  }

  private async _executeHandler(token: Runtime.Types.ProcessToken,
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
