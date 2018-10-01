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
              timerFacade: ITimerFacade) {
    super(flowNodeInstanceService, loggingApiService, metricsService);
    this._eventAggregator = eventAggregator;
    this._timerFacade = timerFacade;
  }

  private get eventAggregator(): IEventAggregator {
    return this._eventAggregator;
  }

  private get timerFacade(): ITimerFacade {
    return this._timerFacade;
  }

  protected async executeInternally(startEvent: Model.Events.StartEvent,
                                    token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    identity: IIdentity): Promise<NextFlowNodeInfo> {

    await this.persistOnEnter(startEvent, token);

    const flowNodeIsMessageStartEvent: boolean = startEvent.messageEventDefinition !== undefined;
    const flowNodeIsSignalStartEvent: boolean = startEvent.signalEventDefinition !== undefined;
    const flowNodeIsTimerStartEvent: boolean = startEvent.timerEventDefinition !== undefined;

    // If the StartEvent is not a regular StartEvent,
    // wait for the defined condition to be fulfilled.
    if (flowNodeIsMessageStartEvent) {
      await this._waitForMessage(startEvent, token, startEvent.messageEventDefinition.messageRef);
    } else if (flowNodeIsSignalStartEvent) {
      await this._waitForSignal(startEvent, token, startEvent.signalEventDefinition.signalRef);
    } else if (flowNodeIsTimerStartEvent) {
      await this._waitForTimerToElapse(startEvent, token, startEvent.timerEventDefinition);
    }

    const nextFlowNode: Model.Base.FlowNode = await processModelFacade.getNextFlowNodeFor(startEvent);

    await this.persistOnExit(startEvent, token);

    return new NextFlowNodeInfo(nextFlowNode, token, processTokenFacade);
  }

  /**
   * Creates a subscription on the EventAggregator and waits to receive the
   * designated message.
   *
   * @async
   * @param flowNode    The FlowNode containing the StartEvent.
   * @param token       The current ProcessToken.
   * @param messageName The message to wait for.
   */
  private async _waitForMessage(startEvent: Model.Events.StartEvent,
                                token: Runtime.Types.ProcessToken,
                                messageName: string): Promise<void> {

    await this.persistOnSuspend(startEvent, token);

    return new Promise<void>((resolve: Function): void => {

      const messageEventName: string = eventAggregatorSettings.routePaths.messageEventReached
        .replace(eventAggregatorSettings.routeParams.messageReference, messageName);

      const subscription: ISubscription = this.eventAggregator.subscribeOnce(messageEventName, async(message: MessageEventReachedMessage) => {

        if (subscription) {
          subscription.dispose();
        }

        await this.persistOnResume(startEvent, token);

        resolve();
      });
    });
  }

  /**
   * Creates a subscription on the EventAggregator and waits to receive the
   * designated signal.
   *
   * @async
   * @param startEvent The FlowNode containing the StartEvent.
   * @param token      The current ProcessToken.
   * @param signalName The signal to wait for.
   */
  private async _waitForSignal(startEvent: Model.Events.StartEvent,
                               token: Runtime.Types.ProcessToken,
                               signalName: string): Promise<void> {

    await this.persistOnSuspend(startEvent, token);

    return new Promise<void>((resolve: Function): void => {

      const signalEventName: string = eventAggregatorSettings.routePaths.signalEventReached
        .replace(eventAggregatorSettings.routeParams.signalReference, signalName);

      const subscription: ISubscription = this.eventAggregator.subscribeOnce(signalEventName, async(message: SignalEventReachedMessage) => {

        if (subscription) {
          subscription.dispose();
        }

        await this.persistOnResume(startEvent, token);

        resolve();
      });
    });
  }

  /**
   * If a timed StartEvent is used, this will delay the events execution
   * until the timer has elapsed.
   *
   * @async
   * @param startEvent The FlowNode containing the StartEvent.
   * @param token      The current ProcessToken.
   */
  private async _waitForTimerToElapse(startEvent: Model.Events.StartEvent,
                                      token: Runtime.Types.ProcessToken,
                                      timerDefinition: Model.EventDefinitions.TimerEventDefinition,
                                     ): Promise<void> {

    await this.persistOnSuspend(startEvent, token);

    return new Promise<void> (async(resolve: Function, reject: Function): Promise<void> => {

      let timerSubscription: ISubscription;

      const timerType: TimerDefinitionType = this.timerFacade.parseTimerDefinitionType(timerDefinition);
      const timerValue: string = this.timerFacade.parseTimerDefinitionValue(timerDefinition);

      const timerElapsed: any = async(): Promise<void> => {

        await this.persistOnResume(startEvent, token);

        const cancelSubscription: boolean = timerSubscription && timerType !== TimerDefinitionType.cycle;

        if (cancelSubscription) {
          timerSubscription.dispose();
        }

        resolve();
      };

      timerSubscription = await this.timerFacade.initializeTimer(startEvent, timerType, timerValue, timerElapsed);
    });
  }
}
