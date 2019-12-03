import {Logger} from 'loggerhythm';

import {IEventAggregator, Subscription} from '@essential-projects/event_aggregator_contracts';
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

  protected async startExecution(
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
        this.eventAggregator.unsubscribe(this.manualTaskSubscription);
        handlerPromise.cancel();
      };

      await this.suspendAndWaitForManualTaskResult(identity, token);
      token.payload = {};

      this.logger.verbose(`Resuming ManualTask instance ${this.flowNodeInstanceId}.`);

      await this.persistOnResume(token);
      processTokenFacade.addResultForFlowNode(this.manualTask.id, this.flowNodeInstanceId, token.payload);
      await this.persistOnExit(token);

      this.publishManualTaskFinishedNotification(identity, token);

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
        this.eventAggregator.unsubscribe(this.manualTaskSubscription);
        handlerPromise.cancel();
      };

      const waitForMessagePromise = this.waitForManualTaskResult(identity, onSuspendToken);

      this.publishManualTaskReachedNotification(identity, onSuspendToken);

      await waitForMessagePromise;
      this.logger.verbose(`Resuming ManualTask instance ${this.flowNodeInstanceId}.`);

      onSuspendToken.payload = {};

      await this.persistOnResume(onSuspendToken);

      processTokenFacade.addResultForFlowNode(this.manualTask.id, this.flowNodeInstanceId, onSuspendToken.payload);
      await this.persistOnExit(onSuspendToken);

      this.publishManualTaskFinishedNotification(identity, onSuspendToken);

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

    this.publishManualTaskReachedNotification(identity, token);

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
    return new Promise<any>(async (resolve): Promise<void> => {
      const finishManualTaskEvent = this.getFinishManualTaskEventName(token.correlationId, token.processInstanceId);
      this.manualTaskSubscription = this.eventAggregator.subscribeOnce(finishManualTaskEvent, resolve);
    });
  }

  private publishManualTaskReachedNotification(identity: IIdentity, token: ProcessToken): void {

    const message = new ActivityReachedMessage(
      token.correlationId,
      token.processModelId,
      token.processInstanceId,
      this.manualTask.id,
      this.flowNodeInstanceId,
      this.manualTask.bpmnType,
      identity,
      token.payload,
    );

    this.eventAggregator.publish(eventAggregatorSettings.messagePaths.manualTaskReached, message);
  }

  private publishManualTaskFinishedNotification(identity: IIdentity, token: ProcessToken): void {

    const message = new ActivityFinishedMessage(
      token.correlationId,
      token.processModelId,
      token.processInstanceId,
      this.manualTask.id,
      this.flowNodeInstanceId,
      this.manualTask.bpmnType,
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
