import {Logger} from 'loggerhythm';

import {IEventAggregator, Subscription} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';

import {FlowNodeInstance, ProcessToken} from '@process-engine/flow_node_instance.contracts';
import {
  eventAggregatorSettings,
  IFlowNodeHandlerFactory,
  IFlowNodePersistenceFacade,
  IProcessModelFacade,
  IProcessTokenFacade,
  MessageEventReachedMessage,
} from '@process-engine/process_engine_contracts';
import {Model} from '@process-engine/process_model.contracts';

import {FlowNodeHandler} from './index';

export class ReceiveTaskHandler extends FlowNodeHandler<Model.Activities.ReceiveTask> {

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

    return this._executeHandler(token, processTokenFacade, processModelFacade, identity);
  }

  protected async _continueAfterSuspend(
    flowNodeInstance: FlowNodeInstance,
    onSuspendToken: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    return this._executeHandler(onSuspendToken, processTokenFacade, processModelFacade, identity);
  }

  protected async _executeHandler(
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    const handlerPromise: Promise<Array<Model.Base.FlowNode>> =
      new Promise<Array<Model.Base.FlowNode>>(async(resolve: Function, reject: Function): Promise<void> => {

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

      token.payload = receivedMessage.currentToken;

      await this.persistOnResume(token);
      this._sendReplyToSender(identity, token);

      processTokenFacade.addResultForFlowNode(this.receiveTask.id, this.flowNodeInstanceId, receivedMessage.currentToken);
      await this.persistOnExit(receivedMessage.currentToken);

      const nextFlowNodeInfo: Array<Model.Base.FlowNode> = processModelFacade.getNextFlowNodesFor(this.receiveTask);

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
  private _sendReplyToSender(identity: IIdentity, token: ProcessToken): void {

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
