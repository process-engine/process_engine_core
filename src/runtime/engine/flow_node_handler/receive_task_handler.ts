import {IContainer} from 'addict-ioc';
import {Logger} from 'loggerhythm';

import {Subscription} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';
import {
  eventAggregatorSettings,
  IProcessModelFacade,
  IProcessTokenFacade,
  MessageEventReachedMessage,
  Model,
  Runtime,
} from '@process-engine/process_engine_contracts';

import {FlowNodeHandlerInterruptible} from './index';

export class ReceiveTaskHandler extends FlowNodeHandlerInterruptible<Model.Activities.ReceiveTask> {

  private messageSubscription: Subscription;

  constructor(container: IContainer, receiveTaskModel: Model.Activities.ReceiveTask) {
    super(container, receiveTaskModel);
    this.logger = new Logger(`processengine:receive_task_handler:${receiveTaskModel.id}`);
  }

  private get receiveTask(): Model.Activities.ReceiveTask {
    return super.flowNode;
  }

  protected async executeInternally(
    token: Runtime.Types.ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Model.Base.FlowNode> {

    this.logger.verbose(`Executing ReceiveTask instance ${this.flowNodeInstanceId}`);
    await this.persistOnEnter(token);
    await this.persistOnSuspend(token);

    return this._executeHandler(token, processTokenFacade, processModelFacade, identity);
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

      const executionPromise: Promise<MessageEventReachedMessage> = this._waitForMessage();

      this.onInterruptedCallback = (): void => {
        if (this.messageSubscription) {
          this.eventAggregator.unsubscribe(this.messageSubscription);
        }
        executionPromise.cancel();
        handlerPromise.cancel();

        return;
      };

      const receivedMessage: MessageEventReachedMessage = await executionPromise;

      await this.persistOnResume(token);
      this._sendReplyToSender(identity, token);

      processTokenFacade.addResultForFlowNode(this.receiveTask.id, receivedMessage.currentToken);
      await this.persistOnExit(receivedMessage.currentToken);

      const nextFlowNodeInfo: Model.Base.FlowNode = processModelFacade.getNextFlowNodeFor(this.receiveTask);

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
  private async _waitForMessage(): Promise<MessageEventReachedMessage> {

    return new Promise<MessageEventReachedMessage>((resolve: Function): void => {

      const messageEventName: string = eventAggregatorSettings
        .messagePaths
        .sendTaskReached
        .replace(eventAggregatorSettings.messageParams.messageReference, this.receiveTask.messageEventDefinition.name);

      this.messageSubscription =
        this.eventAggregator.subscribeOnce(messageEventName, async(message: MessageEventReachedMessage) => {
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
  private _sendReplyToSender(identity: IIdentity, token: Runtime.Types.ProcessToken): void {

    const messageName: string = this.receiveTask.messageEventDefinition.name;

    const messageEventName: string =
      eventAggregatorSettings
        .messagePaths
        .receiveTaskReached
        .replace(eventAggregatorSettings.messageParams.messageReference, messageName);

    const messageToSend: MessageEventReachedMessage = new MessageEventReachedMessage(
      messageName,
      token.correlationId,
      token.processModelId,
      token.processInstanceId,
      this.receiveTask.id,
      this.flowNodeInstanceId,
      identity,
      token.payload);

    this.eventAggregator.publish(messageEventName, messageToSend);
  }
}
