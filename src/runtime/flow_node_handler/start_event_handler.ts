import {Logger} from 'loggerhythm';

import {IEventAggregator, Subscription} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';

import {
  eventAggregatorSettings,
  IFlowNodeHandlerFactory,
  IFlowNodePersistenceFacade,
  IProcessModelFacade,
  IProcessTokenFacade,
  ITimerFacade,
  Model,
  ProcessStartedMessage,
  Runtime,
  TimerDefinitionType,
} from '@process-engine/process_engine_contracts';

import {FlowNodeHandler} from './index';

export class StartEventHandler extends FlowNodeHandler<Model.Events.StartEvent> {

  private _timerFacade: ITimerFacade;

  constructor(
    eventAggregator: IEventAggregator,
    flowNodeHandlerFactory: IFlowNodeHandlerFactory,
    flowNodePersistenceFacade: IFlowNodePersistenceFacade,
    timerFacade: ITimerFacade,
    startEventModel: Model.Events.StartEvent,
  ) {
    super(eventAggregator, flowNodeHandlerFactory, flowNodePersistenceFacade, startEventModel);
    this._timerFacade = timerFacade;
    this.logger = new Logger(`processengine:start_event_handler:${startEventModel.id}`);
  }

  private get startEvent(): Model.Events.StartEvent {
    return super.flowNode;
  }

  protected async executeInternally(
    token: Runtime.Types.ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    this.logger.verbose(`Executing StartEvent instance ${this.flowNodeInstanceId}`);
    await this.persistOnEnter(token);

    return this._executeHandler(token, processTokenFacade, processModelFacade, identity);
  }

  protected async _continueAfterSuspend(
    flowNodeInstance: Runtime.Types.FlowNodeInstance,
    onSuspendToken: Runtime.Types.ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
  ): Promise<Array<Model.Base.FlowNode>> {

    // Only TimerStartEvents are suspendable, so no check is required here.
    const newTokenPayload: any =
      await new Promise<any>(async(resolve: Function, reject: Function): Promise<void> => {
        this._waitForTimerToElapse(onSuspendToken, resolve);
      });

    onSuspendToken.payload = newTokenPayload;
    await this.persistOnResume(onSuspendToken);

    processTokenFacade.addResultForFlowNode(this.startEvent.id, this.flowNodeInstanceId, onSuspendToken.payload);
    await this.persistOnExit(onSuspendToken);

    return processModelFacade.getNextFlowNodesFor(this.startEvent);
  }

  protected async _executeHandler(token: Runtime.Types.ProcessToken,
                                  processTokenFacade: IProcessTokenFacade,
                                  processModelFacade: IProcessModelFacade,
                                  identity: IIdentity): Promise<Array<Model.Base.FlowNode>> {

    this._sendProcessStartedMessage(identity, token, this.startEvent.id);

    const flowNodeIsTimerStartEvent: boolean = this.startEvent.timerEventDefinition !== undefined;

    // TimerStartEvents cannot be auto-started yet and must be handled manually here.
    if (flowNodeIsTimerStartEvent) {
      const newTokenPayload: any = await this._suspendAndWaitForTimerToElapse(token);
      token.payload = newTokenPayload;
      await this.persistOnResume(token);
    }

    processTokenFacade.addResultForFlowNode(this.startEvent.id, this.flowNodeInstanceId, token.payload);
    await this.persistOnExit(token);

    return processModelFacade.getNextFlowNodesFor(this.startEvent);
  }

  /**
   * Sends a message that the ProcessInstance was started.
   *
   * @param identity     The identity that owns the StartEvent instance.
   * @param token        Current token object, which contains all necessary Process Metadata.
   * @param startEventId Id of the used StartEvent.
   */
  private _sendProcessStartedMessage(identity: IIdentity, token: Runtime.Types.ProcessToken, startEventId: string): void {
    const processStartedMessage: ProcessStartedMessage = new ProcessStartedMessage(token.correlationId,
      token.processModelId,
      token.processInstanceId,
      startEventId,
      this.flowNodeInstanceId,
      identity,
      token.payload);

    this.eventAggregator.publish(eventAggregatorSettings.messagePaths.processStarted, processStartedMessage);

    const processStartedBaseName: string = eventAggregatorSettings.messagePaths.processInstanceStarted;
    const processModelIdParam: string = eventAggregatorSettings.messageParams.processModelId;
    const processWithIdStartedMessage: string =
      processStartedBaseName
        .replace(processModelIdParam, token.processModelId);

    this.eventAggregator.publish(processWithIdStartedMessage, processStartedMessage);
  }

  private async _suspendAndWaitForTimerToElapse(currentToken: Runtime.Types.ProcessToken): Promise<any> {
    return new Promise<any>(async(resolve: Function, reject: Function): Promise<void> => {
      this._waitForTimerToElapse(currentToken, resolve);
      await this.persistOnSuspend(currentToken);
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

    let timerSubscription: Subscription;

    const timerType: TimerDefinitionType = this._timerFacade.parseTimerDefinitionType(timerDefinition);
    const timerValue: string = this._timerFacade.parseTimerDefinitionValue(timerDefinition);

    const timerElapsed: any = (): void => {

      const cancelSubscription: boolean = timerSubscription && timerType !== TimerDefinitionType.cycle;
      if (cancelSubscription) {
        this.eventAggregator.unsubscribe(timerSubscription);
      }

      resolveFunc(currentToken.payload);
    };

    timerSubscription = this._timerFacade.initializeTimer(this.startEvent, timerType, timerValue, timerElapsed);
  }
}
