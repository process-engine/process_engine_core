import {Logger} from 'loggerhythm';

import {EventReceivedCallback, IEventAggregator, Subscription} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';

import {FlowNodeInstance, ProcessToken} from '@process-engine/flow_node_instance.contracts';
import {
  EmptyActivityFinishedMessage,
  EmptyActivityReachedMessage,
  IFlowNodeHandlerFactory,
  IFlowNodePersistenceFacade,
  IProcessModelFacade,
  IProcessTokenFacade,
  eventAggregatorSettings,
} from '@process-engine/process_engine_contracts';
import {Model} from '@process-engine/process_model.contracts';

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
    return super.flowNode;
  }

  protected async executeInternally(
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
        const subscriptionIsActive = this.emptyActivitySubscription !== undefined;
        if (subscriptionIsActive) {
          this.eventAggregator.unsubscribe(this.emptyActivitySubscription);
        }
        handlerPromise.cancel();

        return undefined;
      };

      await this.suspendAndWaitForFinishEvent(identity, token);
      await this.persistOnResume(token);

      processTokenFacade.addResultForFlowNode(this.emptyActivity.id, this.flowNodeInstanceId, token.payload);
      await this.persistOnExit(token);

      this.sendEmptyActivityFinishedNotification(identity, token);

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
        const subscriptionIsActive: boolean = this.emptyActivitySubscription !== undefined;
        if (subscriptionIsActive) {
          this.eventAggregator.unsubscribe(this.emptyActivitySubscription);
        }
        handlerPromise.cancel();

        return undefined;
      };

      const waitForContinueEventPromise = await this.waitForFinishEvent(onSuspendToken);

      this.sendEmptyTaskReachedNotification(identity, onSuspendToken);

      await waitForContinueEventPromise;
      await this.persistOnResume(onSuspendToken);

      processTokenFacade.addResultForFlowNode(this.emptyActivity.id, this.flowNodeInstanceId, onSuspendToken.payload);
      await this.persistOnExit(onSuspendToken);

      this.sendEmptyActivityFinishedNotification(identity, onSuspendToken);

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

    this.sendEmptyTaskReachedNotification(identity, token);

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

  /**
   * Publishes a notification on the EventAggregator, informing about a new
   * suspended EmptyActivity.
   *
   * @param identity The identity that owns the EmptyActivity instance.
   * @param token    Contains all infos required for the Notification message.
   */
  private sendEmptyTaskReachedNotification(identity: IIdentity, token: ProcessToken): void {

    const message = new EmptyActivityReachedMessage(
      token.correlationId,
      token.processModelId,
      token.processInstanceId,
      this.emptyActivity.id,
      this.flowNodeInstanceId,
      identity,
      token.payload,
    );

    this.eventAggregator.publish(eventAggregatorSettings.messagePaths.emptyActivityReached, message);
  }

  /**
   * Publishes notifications on the EventAggregator, informing that an EmptyActivity
   * has finished execution.
   *
   * Two notifications will be send:
   * - A global notification that everybody can receive
   * - A notification specifically for this EmptyActivity.
   *
   * @param identity The identity that owns the EmptyActivity instance.
   * @param token    Contains all infos required for the Notification message.
   */
  private sendEmptyActivityFinishedNotification(identity: IIdentity, token: ProcessToken): void {

    const message = new EmptyActivityFinishedMessage(
      token.correlationId,
      token.processModelId,
      token.processInstanceId,
      this.emptyActivity.id,
      this.flowNodeInstanceId,
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
