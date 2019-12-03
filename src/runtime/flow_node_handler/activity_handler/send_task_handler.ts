import {Logger} from 'loggerhythm';

import {EventReceivedCallback, IEventAggregator, Subscription} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';

import {FlowNodeInstance, Model, ProcessToken} from '@process-engine/persistence_api.contracts';
import {
  IFlowNodeHandlerFactory,
  IFlowNodePersistenceFacade,
  IProcessModelFacade,
  IProcessTokenFacade,
  MessageEventReachedMessage,
  eventAggregatorSettings,
} from '@process-engine/process_engine_contracts';

import {ActivityHandler} from './activity_handler';

export class SendTaskHandler extends ActivityHandler<Model.Activities.SendTask> {

  private responseSubscription: Subscription;

  constructor(
    eventAggregator: IEventAggregator,
    flowNodeHandlerFactory: IFlowNodeHandlerFactory,
    flowNodePersistenceFacade: IFlowNodePersistenceFacade,
    sendTaskModel: Model.Activities.SendTask,
  ) {
    super(eventAggregator, flowNodeHandlerFactory, flowNodePersistenceFacade, sendTaskModel);
    this.logger = new Logger(`processengine:send_task_handler:${sendTaskModel.id}`);
  }

  private get sendTask(): Model.Activities.SendTask {
    return this.flowNode;
  }

  protected async startExecution(
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    this.logger.verbose(`Executing SendTask instance ${this.flowNodeInstanceId}`);
    await this.persistOnEnter(token);
    await this.persistOnSuspend(token);

    return this.executeHandler(token, processTokenFacade, processModelFacade, identity);
  }

  protected async continueAfterSuspend(
    flowNodeInstance: FlowNodeInstance,
    onSuspendToken: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    return this.executeHandler(onSuspendToken, processTokenFacade, processModelFacade, identity);
  }

  protected async executeHandler(
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    const handlerPromise = new Promise<Array<Model.Base.FlowNode>>(async (resolve: Function, reject: Function): Promise<void> => {

      this.onInterruptedCallback = (): void => {
        this.eventAggregator.unsubscribe(this.responseSubscription);
        handlerPromise.cancel();
      };

      const onResponseReceivedCallback = async (): Promise<void> => {
        processTokenFacade.addResultForFlowNode(this.sendTask.id, this.flowNodeInstanceId, token.payload);
        await this.persistOnResume(token);
        await this.persistOnExit(token);

        this.publishActivityFinishedNotification(identity, token);

        const nextFlowNodeInfo = processModelFacade.getNextFlowNodesFor(this.sendTask);

        return resolve(nextFlowNodeInfo);
      };

      this.publishActivityReachedNotification(identity, token);

      this.waitForResponseFromReceiveTask(onResponseReceivedCallback);
      this.sendMessage(identity, token);
    });

    return handlerPromise;
  }

  /**
   * Waits for an incoming message from a ReceiveTask, acknowledging the receit of the message.
   *
   * @param callback The function to call upon receiving the message.
   */
  private waitForResponseFromReceiveTask(callback: EventReceivedCallback): void {

    const messageName = this.sendTask.messageEventDefinition.name;

    const messageEventName = eventAggregatorSettings
      .messagePaths
      .receiveTaskReached
      .replace(eventAggregatorSettings.messageParams.messageReference, messageName);

    this.responseSubscription = this.eventAggregator.subscribeOnce(messageEventName, callback);
  }

  /**
   * Publishes the message stored in this SendTask on the EventAggregator.
   *
   * @param identity The identity that owns the SendTask instance.
   * @param token    The current process token.
   */
  private sendMessage(identity: IIdentity, token: ProcessToken): void {

    const messageName = this.sendTask.messageEventDefinition.name;

    const messageEventName = eventAggregatorSettings
      .messagePaths
      .sendTaskReached
      .replace(eventAggregatorSettings.messageParams.messageReference, messageName);

    const messageToSend = new MessageEventReachedMessage(
      messageName,
      token.correlationId,
      token.processModelId,
      token.processInstanceId,
      this.sendTask.id,
      this.flowNodeInstanceId,
      identity,
      token.payload,
    );

    this.eventAggregator.publish(messageEventName, messageToSend);
  }

}
