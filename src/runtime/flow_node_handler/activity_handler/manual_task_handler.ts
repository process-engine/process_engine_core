import {Logger} from 'loggerhythm';

import {IEventAggregator, Subscription} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';

import {FlowNodeInstance, ProcessToken} from '@process-engine/flow_node_instance.contracts';
import {
  FinishManualTaskMessage,
  IFlowNodeHandlerFactory,
  IFlowNodePersistenceFacade,
  IProcessModelFacade,
  IProcessTokenFacade,
  ManualTaskFinishedMessage,
  ManualTaskReachedMessage,
  eventAggregatorSettings,
} from '@process-engine/process_engine_contracts';
import {Model} from '@process-engine/process_model.contracts';

import {ActivityHandler} from './activity_handler';

export class ManualTaskHandler extends ActivityHandler<Model.Activities.ManualTask> {

  private manualTaskSubscription: Subscription;

  constructor(
    eventAggregator: IEventAggregator,
    flowNodeHandlerFactory: IFlowNodeHandlerFactory,
    flowNodePersistenceFacade: IFlowNodePersistenceFacade,
    manualTaskModel: Model.Activities.ManualTask,
  ) {
    super(eventAggregator, flowNodeHandlerFactory, flowNodePersistenceFacade, manualTaskModel);
    this.logger = new Logger(`processengine:manual_task_handler:${manualTaskModel.id}`);
  }

  private get manualTask(): Model.Activities.ManualTask {
    return this.flowNode;
  }

  protected async executeInternally(
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    this.logger.verbose(`Executing ManualTask instance ${this.flowNodeInstanceId}`);
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
        const subscriptionIsActive: boolean = this.manualTaskSubscription !== undefined;
        if (subscriptionIsActive) {
          this.eventAggregator.unsubscribe(this.manualTaskSubscription);
        }
        handlerPromise.cancel();

        return undefined;
      };

      const manualTaskResult = await this.suspendAndWaitForManualTaskResult(identity, token);
      token.payload = manualTaskResult;

      await this.persistOnResume(token);

      processTokenFacade.addResultForFlowNode(this.manualTask.id, this.flowNodeInstanceId, manualTaskResult);
      await this.persistOnExit(token);

      this.sendManualTaskFinishedNotification(identity, token);

      const nextFlowNodeInfo = processModelFacade.getNextFlowNodesFor(this.manualTask);

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
        const subscriptionIsActive = this.manualTaskSubscription !== undefined;
        if (subscriptionIsActive) {
          this.eventAggregator.unsubscribe(this.manualTaskSubscription);
        }
        handlerPromise.cancel();

        return undefined;
      };

      const waitForMessagePromise = await this.waitForManualTaskResult(identity, onSuspendToken);

      this.sendManualTaskReachedNotification(identity, onSuspendToken);

      const manualTaskResult = await waitForMessagePromise;

      onSuspendToken.payload = manualTaskResult;

      await this.persistOnResume(onSuspendToken);

      processTokenFacade.addResultForFlowNode(this.manualTask.id, this.flowNodeInstanceId, manualTaskResult);
      await this.persistOnExit(onSuspendToken);

      this.sendManualTaskFinishedNotification(identity, onSuspendToken);

      const nextFlowNodeInfo = processModelFacade.getNextFlowNodesFor(this.manualTask);

      return resolve(nextFlowNodeInfo);
    });

    return handlerPromise;
  }

  /**
   * Suspends the handler and waits for a FinishManualTaskMessage.
   * Upon receiving the messsage, the handler will be resumed with the received
   * result set.
   *
   * @async
   * @param identity The identity that owns the ManualTask instance.
   * @param token    Contains all relevant info the EventAggregator will need for
   *                 creating the EventSubscription.
   * @returns        The recevied ManualTask result.
   */
  private async suspendAndWaitForManualTaskResult(identity: IIdentity, token: ProcessToken): Promise<any> {
    const waitForManualTaskResultPromise = this.waitForManualTaskResult(identity, token);
    await this.persistOnSuspend(token);

    this.sendManualTaskReachedNotification(identity, token);

    return waitForManualTaskResultPromise;
  }

  /**
   * Waits for a FinishManualTaskMessage.
   * Upon receiving the messsage, the handler will be resumed.
   *
   * @async
   * @param identity The identity that owns the ManualTask instance.
   * @param token    Contains all relevant info the EventAggregator will need for
   *                 creating the EventSubscription.
   * @returns        The recevied ManualTask result.
   */
  private waitForManualTaskResult(identity: IIdentity, token: ProcessToken): Promise<any> {

    return new Promise<any>(async (resolve: Function): Promise<void> => {

      const finishManualTaskEvent = this.getFinishManualTaskEventName(token.correlationId, token.processInstanceId);

      this.manualTaskSubscription =
        this.eventAggregator.subscribeOnce(finishManualTaskEvent, (message: FinishManualTaskMessage): void => {
          // An empty object is used, because ManualTasks do not yield results.
          const manualTaskResult = {};

          resolve(manualTaskResult);
        });
    });
  }

  /**
   * Publishes a notification on the EventAggregator, informing about a new
   * suspended ManualTask.
   *
   * @param identity The identity that owns the ManualTask instance.
   * @param token    Contains all infos required for the Notification message.
   */
  private sendManualTaskReachedNotification(identity: IIdentity, token: ProcessToken): void {

    const message = new ManualTaskReachedMessage(
      token.correlationId,
      token.processModelId,
      token.processInstanceId,
      this.manualTask.id,
      this.flowNodeInstanceId,
      identity,
      token.payload,
    );

    this.eventAggregator.publish(eventAggregatorSettings.messagePaths.manualTaskReached, message);
  }

  /**
   * Publishes notifications on the EventAggregator, informing that a ManualTask
   * has finished execution.
   *
   * Two notifications will be send:
   * - A global notification that everybody can receive
   * - A notification specifically for this ManualTask.
   *
   * @param identity The identity that owns the ManualTask instance.
   * @param token    Contains all infos required for the Notification message.
   */
  private sendManualTaskFinishedNotification(identity: IIdentity, token: ProcessToken): void {

    const message = new ManualTaskFinishedMessage(
      token.correlationId,
      token.processModelId,
      token.processInstanceId,
      this.manualTask.id,
      this.flowNodeInstanceId,
      identity,
      token.payload,
    );

    // FlowNode-specific notification
    const manualTaskFinishedEvent = this.getManualTaskFinishedEventName(token.correlationId, token.processInstanceId);
    this.eventAggregator.publish(manualTaskFinishedEvent, message);

    // Global notification
    this.eventAggregator.publish(eventAggregatorSettings.messagePaths.manualTaskFinished, message);
  }

  private getFinishManualTaskEventName(correlationId: string, processInstanceId: string): string {

    const finishManualTaskEvent = eventAggregatorSettings.messagePaths.finishManualTask
      .replace(eventAggregatorSettings.messageParams.correlationId, correlationId)
      .replace(eventAggregatorSettings.messageParams.processInstanceId, processInstanceId)
      .replace(eventAggregatorSettings.messageParams.flowNodeInstanceId, this.flowNodeInstanceId);

    return finishManualTaskEvent;
  }

  private getManualTaskFinishedEventName(correlationId: string, processInstanceId: string): string {

    // FlowNode-specific notification
    const manualTaskFinishedEvent = eventAggregatorSettings.messagePaths.manualTaskWithInstanceIdFinished
      .replace(eventAggregatorSettings.messageParams.correlationId, correlationId)
      .replace(eventAggregatorSettings.messageParams.processInstanceId, processInstanceId)
      .replace(eventAggregatorSettings.messageParams.flowNodeInstanceId, this.flowNodeInstanceId);

    return manualTaskFinishedEvent;
  }

}
