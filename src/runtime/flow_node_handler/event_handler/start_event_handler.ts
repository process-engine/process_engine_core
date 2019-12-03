import {Logger} from 'loggerhythm';

import {IEventAggregator, Subscription} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';

import {FlowNodeInstance, Model, ProcessToken} from '@process-engine/persistence_api.contracts';
import {
  IFlowNodeHandlerFactory,
  IFlowNodePersistenceFacade,
  IProcessModelFacade,
  IProcessTokenFacade,
  ITimerFacade,
  ProcessStartedMessage,
  eventAggregatorSettings,
} from '@process-engine/process_engine_contracts';

import {EventHandler} from './index';

export class StartEventHandler extends EventHandler<Model.Events.StartEvent> {

  private timerFacade: ITimerFacade;
  private timerSubscription: Subscription;

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

  protected async startExecution(
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

    const handlerPromise = new Promise<Array<Model.Base.FlowNode>>(async (resolve: Function, reject: Function): Promise<void> => {

      try {
        this.onInterruptedCallback = (interruptionToken: ProcessToken): void => {
          this.timerFacade.cancelTimerSubscription(this.timerSubscription);
          processTokenFacade.addResultForFlowNode(this.startEvent.id, this.flowNodeInstanceId, interruptionToken);
          handlerPromise.cancel();
        };

        // Only TimerStartEvents are suspendable, so no check is required here.
        const newTokenPayload = await new Promise<any>(async (timerResolve: Function): Promise<void> => {
          this.waitForTimerToElapse(onSuspendToken, processTokenFacade, timerResolve);
        });

        onSuspendToken.payload = newTokenPayload;
        await this.persistOnResume(onSuspendToken);

        processTokenFacade.addResultForFlowNode(this.startEvent.id, this.flowNodeInstanceId, onSuspendToken.payload);
        await this.persistOnExit(onSuspendToken);

        const nextFlowNodeInfo = processModelFacade.getNextFlowNodesFor(this.startEvent);

        return resolve(nextFlowNodeInfo);
      } catch (error) {
        await this.persistOnError(onSuspendToken, error);
        return reject(error);
      }
    });

    return handlerPromise;
  }

  protected async executeHandler(
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    const handlerPromise = new Promise<Array<Model.Base.FlowNode>>(async (resolve: Function, reject: Function): Promise<void> => {

      try {
        this.onInterruptedCallback = (interruptionToken: ProcessToken): void => {
          this.timerFacade.cancelTimerSubscription(this.timerSubscription);
          processTokenFacade.addResultForFlowNode(this.startEvent.id, this.flowNodeInstanceId, interruptionToken);
          handlerPromise.cancel();
        };

        this.sendProcessStartedMessage(identity, token, this.startEvent.id);

        const flowNodeIsTimerStartEvent = this.startEvent.timerEventDefinition != undefined;

        // Cyclic TimerStartEvents are started automatically through the Cronjob Service.
        // All other Timer types are started through this handler, since they cannot be automatically scheduled.
        if (flowNodeIsTimerStartEvent) {

          if (this.startEvent.timerEventDefinition.timerType !== Model.Events.Definitions.TimerType.timeCycle) {
            const newTokenPayload = await this.suspendAndWaitForTimerToElapse(token, processTokenFacade);
            token.payload = newTokenPayload;
            await this.persistOnResume(token);
          }
        }

        processTokenFacade.addResultForFlowNode(this.startEvent.id, this.flowNodeInstanceId, token.payload);
        await this.persistOnExit(token);

        const nextFlowNodeInfo = processModelFacade.getNextFlowNodesFor(this.startEvent);

        return resolve(nextFlowNodeInfo);
      } catch (error) {
        await this.persistOnError(token, error);
        return reject(error);
      }
    });

    return handlerPromise;
  }

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

  private async suspendAndWaitForTimerToElapse(currentToken: ProcessToken, processTokenFacade: IProcessTokenFacade): Promise<any> {
    return new Promise<any>(async (resolve: Function, reject: Function): Promise<void> => {
      try {
        this.logger.verbose('Initializing Timer');
        this.waitForTimerToElapse(currentToken, processTokenFacade, resolve);
        this.logger.verbose('Suspending activity until timer expires');
        await this.persistOnSuspend(currentToken);
      } catch (error) {
        reject(error);
      }
    });
  }

  private waitForTimerToElapse(currentToken: ProcessToken, processTokenFacade: IProcessTokenFacade, resolveFunc: Function): void {

    const timerDefinition = this.startEvent.timerEventDefinition;

    const timerElapsed = (): void => {
      this.logger.verbose('Timer has expired, continuing execution');
      this.timerFacade.cancelTimerSubscription(this.timerSubscription);
      resolveFunc(currentToken.payload);
    };

    this.timerSubscription = this.timerFacade.initializeTimer(this.startEvent, timerDefinition, processTokenFacade, timerElapsed);
  }

}
