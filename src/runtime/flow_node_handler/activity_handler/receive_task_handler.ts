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

export class ReceiveTaskHandler extends ActivityHandler<Model.Activities.ReceiveTask> {

  private messageSubscription: Subscription;

  constructor(
    eventAggregator: IEventAggregator,
    flowNodeHandlerFactory: IFlowNodeHandlerFactory,
    flowNodePersistenceFacade: IFlowNodePersistenceFacade,
    receiveTaskModel: Model.Activities.ReceiveTask,
  ) {
    super(eventAggregator, flowNodeHandlerFactory, flowNodePersistenceFacade, receiveTaskModel);
    this.logger = new Logger(`processengine:receive_task_handler:${receiveTaskModel.id}`);
  }

  private get receiveTask(): Model.Activities.ReceiveTask {
    return super.flowNode;
  }

  protected async executeInternally(
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    this.logger.verbose(`Executing ReceiveTask instance ${this.flowNodeInstanceId}`);
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

      const executionPromise = this.waitForMessage();

      this.onInterruptedCallback = (): void => {
        if (this.messageSubscription) {
          this.eventAggregator.unsubscribe(this.messageSubscription);
        }
        executionPromise.cancel();
        handlerPromise.cancel();

        return undefined;
      };

      const receivedMessage = await executionPromise;

      token.payload = receivedMessage.currentToken;

      await this.persistOnResume(token);
      this.sendReplyToSender(identity, token);

      processTokenFacade.addResultForFlowNode(this.receiveTask.id, this.flowNodeInstanceId, receivedMessage.currentToken);
      await this.persistOnExit(receivedMessage.currentToken);

      const nextFlowNodeInfo = processModelFacade.getNextFlowNodesFor(this.receiveTask);

      return resolve(nextFlowNodeInfo);
    });

    return handlerPromise;
  }

  /**
   * Waits for an incoming message from a SendTask.
   *
   * @async
   * @returns The received message.
   */
  private async waitForMessage(): Promise<MessageEventReachedMessage> {

    return new Promise<MessageEventReachedMessage>((resolve: Function): void => {

      const messageEventName = eventAggregatorSettings
        .messagePaths
        .sendTaskReached
        .replace(eventAggregatorSettings.messageParams.messageReference, this.receiveTask.messageEventDefinition.name);

      this.messageSubscription =
        this.eventAggregator.subscribeOnce(messageEventName, (message: MessageEventReachedMessage): void => {
          resolve(message);
        });
    });
  }

  /**
   * Publishes a message to the EventAggregator, informing any SendTasks that
   * may be listening about the receit of the message.
   *
   * @param identity The identity that owns the ReceiveTask instance.
   * @param token    The current ProcessToken.
   */
  private sendReplyToSender(identity: IIdentity, token: ProcessToken): void {

    const messageName = this.receiveTask.messageEventDefinition.name;

    const messageEventName =
      eventAggregatorSettings
        .messagePaths
        .receiveTaskReached
        .replace(eventAggregatorSettings.messageParams.messageReference, messageName);

    const messageToSend = new MessageEventReachedMessage(
      messageName,
      token.correlationId,
      token.processModelId,
      token.processInstanceId,
      this.receiveTask.id,
      this.flowNodeInstanceId,
      identity,
      token.payload,
    );

    this.eventAggregator.publish(messageEventName, messageToSend);
  }

}
