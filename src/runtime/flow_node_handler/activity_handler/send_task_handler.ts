import {Logger} from 'loggerhythm';

import {IEventAggregator, Subscription} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';

import {FlowNodeInstance, ProcessToken} from '@process-engine/flow_node_instance.contracts';
import {
  IFlowNodeHandlerFactory,
  IFlowNodePersistenceFacade,
  IProcessModelFacade,
  IProcessTokenFacade,
  MessageEventReachedMessage,
  eventAggregatorSettings,
} from '@process-engine/process_engine_contracts';
import {Model} from '@process-engine/process_model.contracts';

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

  protected async executeInternally(
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
        if (this.responseSubscription) {
          this.eventAggregator.unsubscribe(this.responseSubscription);
        }
        handlerPromise.cancel();

        return undefined;
      };

      const onResponseReceivedCallback = async (): Promise<void> => {

        processTokenFacade.addResultForFlowNode(this.sendTask.id, this.flowNodeInstanceId, token.payload);
        await this.persistOnResume(token);
        await this.persistOnExit(token);

        const nextFlowNodeInfo = processModelFacade.getNextFlowNodesFor(this.sendTask);

        return resolve(nextFlowNodeInfo);
      };

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
  private waitForResponseFromReceiveTask(callback: Function): void {

    const messageName = this.sendTask.messageEventDefinition.name;

    const messageEventName = eventAggregatorSettings
      .messagePaths
      .receiveTaskReached
      .replace(eventAggregatorSettings.messageParams.messageReference, messageName);

    this.responseSubscription = this.eventAggregator.subscribeOnce(messageEventName, (): void => {
      callback();
    });
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
