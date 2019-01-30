import {IContainer} from 'addict-ioc';
import {Logger} from 'loggerhythm';

import {Subscription} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';

import {
  eventAggregatorSettings,
  FinishManualTaskMessage,
  IProcessModelFacade,
  IProcessTokenFacade,
  ManualTaskFinishedMessage,
  ManualTaskReachedMessage,
  Model,
  Runtime,
} from '@process-engine/process_engine_contracts';

import {FlowNodeHandlerInterruptible} from './index';

export class ManualTaskHandler extends FlowNodeHandlerInterruptible<Model.Activities.ManualTask> {

  private manualTaskSubscription: Subscription;

  constructor(container: IContainer, manualTaskModel: Model.Activities.ManualTask) {
    super(container, manualTaskModel);
    this.logger = new Logger(`processengine:manual_task_handler:${manualTaskModel.id}`);
  }

  private get manualTask(): Model.Activities.ManualTask {
    return super.flowNode;
  }

  protected async executeInternally(
    token: Runtime.Types.ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Model.Base.FlowNode> {

    this.logger.verbose(`Executing ManualTask instance ${this.flowNodeInstanceId}`);
    await this.persistOnEnter(token);
    await this.persistOnSuspend(token);

    return this._executeHandler(token, processTokenFacade, processModelFacade, identity);
  }

  protected async _continueAfterEnter(
    onEnterToken: Runtime.Types.ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Model.Base.FlowNode> {

    await this.persistOnSuspend(onEnterToken);

    return this._executeHandler(onEnterToken, processTokenFacade, processModelFacade, identity);
  }

  protected async _continueAfterSuspend(
    flowNodeInstance: Runtime.Types.FlowNodeInstance,
    onSuspendToken: Runtime.Types.ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Model.Base.FlowNode> {

    return this._executeHandler(onSuspendToken, processTokenFacade, processModelFacade, identity);
  }

  protected async _executeHandler(
    token: Runtime.Types.ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Model.Base.FlowNode> {

    const handlerPromise: Promise<Model.Base.FlowNode> =
      new Promise<Model.Base.FlowNode>(async(resolve: Function, reject: Function): Promise<void> => {

      const executionPromise: Promise<any> = this._waitForManualTaskResult(identity, token);

      this.onInterruptedCallback = (): void => {
        if (this.manualTaskSubscription) {
          this.eventAggregator.unsubscribe(this.manualTaskSubscription);
        }
        executionPromise.cancel();
        handlerPromise.cancel();

        return;
      };

      const manualTaskResult: any = await executionPromise;
      token.payload = manualTaskResult;

      await this.persistOnResume(token);

      processTokenFacade.addResultForFlowNode(this.manualTask.id, manualTaskResult);
      await this.persistOnExit(token);

      this._sendManualTaskFinishedNotification(identity, token);

      const nextFlowNodeInfo: Model.Base.FlowNode = processModelFacade.getNextFlowNodeFor(this.manualTask);

      return resolve(nextFlowNodeInfo);
    });

    return handlerPromise;
  }

  /**
   * Suspends the current handler and waits for a FinishManualTaskMessage.
   * Upon receiving the messsage, the handler will be resumed.
   *
   * @async
   * @param identity The identity that owns the ManualTask instance.
   * @param token    Contains all relevant info the EventAggregator will need for
   *                 creating the EventSubscription.
   * @returns        The recevied ManualTask result.
   */
  private _waitForManualTaskResult(identity: IIdentity, token: Runtime.Types.ProcessToken): Promise<any> {

    return new Promise<any>(async(resolve: Function): Promise<void> => {

      const finishManualTaskEvent: string = this._getFinishManualTaskEventName(token.correlationId, token.processInstanceId);

      this.manualTaskSubscription =
        this.eventAggregator.subscribeOnce(finishManualTaskEvent, (message: FinishManualTaskMessage): void => {
          // An empty object is used, because ManualTasks do not yield results.
          const manualTaskResult: any = {};

          resolve(manualTaskResult);
        });

      this._sendManualTaskReachedNotification(identity, token);
    });
  }

  /**
   * Publishes a notification on the EventAggregator, informing about a new
   * suspended ManualTask.
   *
   * @param identity The identity that owns the ManualTask instance.
   * @param token    Contains all infos required for the Notification message.
   */
  private _sendManualTaskReachedNotification(identity: IIdentity, token: Runtime.Types.ProcessToken): void {

    const message: ManualTaskReachedMessage = new ManualTaskReachedMessage(token.correlationId,
                                                                       token.processModelId,
                                                                       token.processInstanceId,
                                                                       this.manualTask.id,
                                                                       this.flowNodeInstanceId,
                                                                       identity,
                                                                       token.payload);

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
  private _sendManualTaskFinishedNotification(identity: IIdentity, token: Runtime.Types.ProcessToken): void {

    const message: ManualTaskFinishedMessage = new ManualTaskFinishedMessage(token.correlationId,
                                                                         token.processModelId,
                                                                         token.processInstanceId,
                                                                         this.manualTask.id,
                                                                         this.flowNodeInstanceId,
                                                                         identity,
                                                                         token.payload);

    // FlowNode-specific notification
    const manualTaskFinishedEvent: string = this._getManualTaskFinishedEventName(token.correlationId, token.processInstanceId);
    this.eventAggregator.publish(manualTaskFinishedEvent, message);

    // Global notification
    this.eventAggregator.publish(eventAggregatorSettings.messagePaths.manualTaskFinished, message);
  }

  private _getFinishManualTaskEventName(correlationId: string, processInstanceId: string): string {

    const finishManualTaskEvent: string = eventAggregatorSettings.messagePaths.finishManualTask
      .replace(eventAggregatorSettings.messageParams.correlationId, correlationId)
      .replace(eventAggregatorSettings.messageParams.processInstanceId, processInstanceId)
      .replace(eventAggregatorSettings.messageParams.flowNodeInstanceId, this.flowNodeInstanceId);

    return finishManualTaskEvent;
  }

  private _getManualTaskFinishedEventName(correlationId: string, processInstanceId: string): string {

    // FlowNode-specific notification
    const manualTaskFinishedEvent: string = eventAggregatorSettings.messagePaths.manualTaskWithInstanceIdFinished
      .replace(eventAggregatorSettings.messageParams.correlationId, correlationId)
      .replace(eventAggregatorSettings.messageParams.processInstanceId, processInstanceId)
      .replace(eventAggregatorSettings.messageParams.flowNodeInstanceId, this.flowNodeInstanceId);

    return manualTaskFinishedEvent;
  }
}
