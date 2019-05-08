import {Logger} from 'loggerhythm';

import {IEventAggregator, Subscription} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';

import {FlowNodeInstance, ProcessToken} from '@process-engine/flow_node_instance.contracts';
import {
  IFlowNodeHandlerFactory,
  IFlowNodePersistenceFacade,
  IProcessModelFacade,
  IProcessTokenFacade,
  ITimerFacade,
  ProcessStartedMessage,
  TimerDefinitionType,
  eventAggregatorSettings,
} from '@process-engine/process_engine_contracts';
import {Model} from '@process-engine/process_model.contracts';

import {EventHandler} from './index';

export class StartEventHandler extends EventHandler<Model.Events.StartEvent> {

  private timerFacade: ITimerFacade;

  constructor(
    eventAggregator: IEventAggregator,
    flowNodeHandlerFactory: IFlowNodeHandlerFactory,
    flowNodePersistenceFacade: IFlowNodePersistenceFacade,
    timerFacade: ITimerFacade,
    startEventModel: Model.Events.StartEvent,
  ) {
    super(eventAggregator, flowNodeHandlerFactory, flowNodePersistenceFacade, startEventModel);
    this.timerFacade = timerFacade;
    this.logger = new Logger(`processengine:start_event_handler:${startEventModel.id}`);
  }

  private get startEvent(): Model.Events.StartEvent {
    return this.flowNode;
  }

  protected async executeInternally(
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    this.logger.verbose(`Executing StartEvent instance ${this.flowNodeInstanceId}`);
    await this.persistOnEnter(token);

    return this.executeHandler(token, processTokenFacade, processModelFacade, identity);
  }

  protected async continueAfterSuspend(
    flowNodeInstance: FlowNodeInstance,
    onSuspendToken: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
  ): Promise<Array<Model.Base.FlowNode>> {

    // Only TimerStartEvents are suspendable, so no check is required here.
    const newTokenPayload =
      await new Promise<any>(async (resolve: Function, reject: Function): Promise<void> => {
        this.waitForTimerToElapse(onSuspendToken, resolve);
      });

    onSuspendToken.payload = newTokenPayload;
    await this.persistOnResume(onSuspendToken);

    processTokenFacade.addResultForFlowNode(this.startEvent.id, this.flowNodeInstanceId, onSuspendToken.payload);
    await this.persistOnExit(onSuspendToken);

    return processModelFacade.getNextFlowNodesFor(this.startEvent);
  }

  protected async executeHandler(
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    this.sendProcessStartedMessage(identity, token, this.startEvent.id);

    const flowNodeIsTimerStartEvent = this.startEvent.timerEventDefinition !== undefined;

    // TimerStartEvents cannot be auto-started yet and must be handled manually here.
    if (flowNodeIsTimerStartEvent) {
      const newTokenPayload = await this.suspendAndWaitForTimerToElapse(token);
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
  private sendProcessStartedMessage(identity: IIdentity, token: ProcessToken, startEventId: string): void {
    const processStartedMessage = new ProcessStartedMessage(
      token.correlationId,
      token.processModelId,
      token.processInstanceId,
      startEventId,
      this.flowNodeInstanceId,
      identity,
      token.payload,
    );

    this.eventAggregator.publish(eventAggregatorSettings.messagePaths.processStarted, processStartedMessage);

    const processStartedBaseName = eventAggregatorSettings.messagePaths.processInstanceWithIdStarted;
    const processModelIdParam = eventAggregatorSettings.messageParams.processModelId;
    const processWithIdStartedMessage = processStartedBaseName.replace(processModelIdParam, token.processModelId);

    this.eventAggregator.publish(processWithIdStartedMessage, processStartedMessage);
  }

  private async suspendAndWaitForTimerToElapse(currentToken: ProcessToken): Promise<any> {
    return new Promise<any>(async (resolve: Function, reject: Function): Promise<void> => {
      this.waitForTimerToElapse(currentToken, resolve);
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
  private waitForTimerToElapse(currentToken: ProcessToken, resolveFunc: Function): void {

    const timerDefinition = this.startEvent.timerEventDefinition;

    let timerSubscription: Subscription;

    const timerType = this.timerFacade.parseTimerDefinitionType(timerDefinition);
    const timerValue = this.timerFacade.parseTimerDefinitionValue(timerDefinition);

    const timerElapsed = (): void => {

      const cancelSubscription = timerSubscription && timerType !== TimerDefinitionType.cycle;
      if (cancelSubscription) {
        this.eventAggregator.unsubscribe(timerSubscription);
      }

      resolveFunc(currentToken.payload);
    };

    timerSubscription = this.timerFacade.initializeTimer(this.startEvent, timerType, timerValue, timerElapsed);
  }

}
