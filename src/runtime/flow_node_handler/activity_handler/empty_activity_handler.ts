import {Logger} from 'loggerhythm';

import {EventReceivedCallback, IEventAggregator, Subscription} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';

import {FlowNodeInstance, Model, ProcessToken} from '@process-engine/persistence_api.contracts';
import {
  ActivityFinishedMessage,
  ActivityReachedMessage,
  IFlowNodeHandlerFactory,
  IFlowNodePersistenceFacade,
  IProcessModelFacade,
  IProcessTokenFacade,
  eventAggregatorSettings,
} from '@process-engine/process_engine_contracts';

import {ActivityHandler} from './activity_handler';

// This type of handler doesn't actually do anything but pass on the token it receives.
// Think of it as a kind of break point.
export class EmptyActivityHandler extends ActivityHandler<Model.Activities.EmptyActivity> {

  private emptyActivitySubscription: Subscription;

  constructor(
    eventAggregator: IEventAggregator,
    flowNodeHandlerFactory: IFlowNodeHandlerFactory,
    flowNodePersistenceFacade: IFlowNodePersistenceFacade,
    emptyActivityModel: Model.Activities.EmptyActivity,
  ) {
    super(eventAggregator, flowNodeHandlerFactory, flowNodePersistenceFacade, emptyActivityModel);
    this.logger = new Logger(`processengine:empty_activity_handler:${emptyActivityModel.id}`);
  }

  private get emptyActivity(): Model.Activities.EmptyActivity {
    return this.flowNode;
  }

  protected async startExecution(
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    this.logger.verbose(`Executing empty activity instance ${this.flowNodeInstanceId}`);
    await this.persistOnEnter(token);

    return this.executeHandler(token, processTokenFacade, processModelFacade, identity);
  }

  protected async executeHandler(
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    const handlerPromise = new Promise<Array<Model.Base.FlowNode>>(async (resolve: Function, reject: Function): Promise<void> => {

      this.onInterruptedCallback = (): void => {
        this.eventAggregator.unsubscribe(this.emptyActivitySubscription);
        handlerPromise.cancel();
      };

      await this.suspendAndWaitForFinishEvent(identity, token);
      this.logger.verbose(`Resuming EmptyActivity instance ${this.flowNodeInstanceId}.`);

      await this.persistOnResume(token);
      processTokenFacade.addResultForFlowNode(this.emptyActivity.id, this.flowNodeInstanceId, token.payload);
      await this.persistOnExit(token);

      this.publishEmptyActivityFinishedNotification(identity, token);

      const nextFlowNodeInfo = processModelFacade.getNextFlowNodesFor(this.emptyActivity);

      return resolve(nextFlowNodeInfo);
    });

    return handlerPromise;
  }

  protected async continueAfterSuspend(
    flowNodeInstance: FlowNodeInstance,
    onSuspendToken: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    const handlerPromise = new Promise<Array<Model.Base.FlowNode>>(async (resolve: Function, reject: Function): Promise<void> => {

      this.onInterruptedCallback = (): void => {
        this.eventAggregator.unsubscribe(this.emptyActivitySubscription);
        handlerPromise.cancel();
      };

      const waitForContinueEventPromise = this.waitForFinishEvent(onSuspendToken);

      this.publishEmptyActivityReachedNotification(identity, onSuspendToken);

      await waitForContinueEventPromise;
      this.logger.verbose(`Resuming EmptyActivity instance ${this.flowNodeInstanceId}.`);

      await this.persistOnResume(onSuspendToken);
      processTokenFacade.addResultForFlowNode(this.emptyActivity.id, this.flowNodeInstanceId, onSuspendToken.payload);
      await this.persistOnExit(onSuspendToken);

      this.publishEmptyActivityFinishedNotification(identity, onSuspendToken);

      const nextFlowNodeInfo = processModelFacade.getNextFlowNodesFor(this.emptyActivity);

      return resolve(nextFlowNodeInfo);
    });

    return handlerPromise;
  }

  /**
   * Suspends the handler and waits for a FinishEmptyActivityMessage.
   * Upon receiving the messsage, the handler will be resumed.
   *
   * @async
   * @param identity The identity that owns the EmptyActivity instance.
   * @param token    Contains all relevant info the EventAggregator will need for
   *                 creating the EventSubscription.
   */
  private async suspendAndWaitForFinishEvent(identity: IIdentity, token: ProcessToken): Promise<any> {
    const waitForEmptyActivityResultPromise: Promise<any> = this.waitForFinishEvent(token);
    await this.persistOnSuspend(token);

    this.publishEmptyActivityReachedNotification(identity, token);

    return waitForEmptyActivityResultPromise;
  }

  /**
   * Waits for a FinishEmptyActivityMessage.
   * Upon receiving the messsage, the handler will be resumed.
   *
   * @async
   * @param identity The identity that owns the EmptyActivity instance.
   * @param token    Contains all relevant info the EventAggregator will need for
   *                 creating the EventSubscription.
   */
  private waitForFinishEvent(token: ProcessToken): Promise<any> {
    return new Promise<any>(async (resolve: EventReceivedCallback): Promise<void> => {
      const continueEmptyActivityEvent = this.getFinishEmptyActivityEventName(token.correlationId, token.processInstanceId);
      this.emptyActivitySubscription = this.eventAggregator.subscribeOnce(continueEmptyActivityEvent, resolve);
    });
  }

  private publishEmptyActivityReachedNotification(identity: IIdentity, token: ProcessToken): void {

    const message = new ActivityReachedMessage(
      token.correlationId,
      token.processModelId,
      token.processInstanceId,
      this.emptyActivity.id,
      this.flowNodeInstanceId,
      this.emptyActivity.bpmnType,
      identity,
      token.payload,
    );

    this.eventAggregator.publish(eventAggregatorSettings.messagePaths.emptyActivityReached, message);
  }

  private publishEmptyActivityFinishedNotification(identity: IIdentity, token: ProcessToken): void {

    const message = new ActivityFinishedMessage(
      token.correlationId,
      token.processModelId,
      token.processInstanceId,
      this.emptyActivity.id,
      this.flowNodeInstanceId,
      this.emptyActivity.bpmnType,
      identity,
      token.payload,
    );

    // FlowNode-specific notification
    const emptyActivityFinishedEvent = this.getEmptyActivityFinishedEventName(token.correlationId, token.processInstanceId);
    this.eventAggregator.publish(emptyActivityFinishedEvent, message);

    // Global notification
    this.eventAggregator.publish(eventAggregatorSettings.messagePaths.emptyActivityFinished, message);
  }

  private getFinishEmptyActivityEventName(correlationId: string, processInstanceId: string): string {

    const finishEmptyActivityEvent = eventAggregatorSettings.messagePaths.finishEmptyActivity
      .replace(eventAggregatorSettings.messageParams.correlationId, correlationId)
      .replace(eventAggregatorSettings.messageParams.processInstanceId, processInstanceId)
      .replace(eventAggregatorSettings.messageParams.flowNodeInstanceId, this.flowNodeInstanceId);

    return finishEmptyActivityEvent;
  }

  private getEmptyActivityFinishedEventName(correlationId: string, processInstanceId: string): string {

    // FlowNode-specific notification
    const emptyActivityFinishedEvent = eventAggregatorSettings.messagePaths.emptyActivityWithInstanceIdFinished
      .replace(eventAggregatorSettings.messageParams.correlationId, correlationId)
      .replace(eventAggregatorSettings.messageParams.processInstanceId, processInstanceId)
      .replace(eventAggregatorSettings.messageParams.flowNodeInstanceId, this.flowNodeInstanceId);

    return emptyActivityFinishedEvent;
  }

}
