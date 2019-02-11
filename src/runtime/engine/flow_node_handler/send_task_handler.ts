import {Logger} from 'loggerhythm';

import {IEventAggregator, Subscription} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';
import {
  eventAggregatorSettings,
  IFlowNodeHandlerFactory,
  IFlowNodePersistenceFacade,
  IProcessModelFacade,
  IProcessTokenFacade,
  MessageEventReachedMessage,
  Model,
  Runtime,
} from '@process-engine/process_engine_contracts';

import {FlowNodeHandlerInterruptible} from './index';

export class SendTaskHandler extends FlowNodeHandlerInterruptible<Model.Activities.SendTask> {

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
    return super.flowNode;
  }

  protected async executeInternally(
    token: Runtime.Types.ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    this.logger.verbose(`Executing SendTask instance ${this.flowNodeInstanceId}`);
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
  ): Promise<Array<Model.Base.FlowNode>> {

    return this._executeHandler(onSuspendToken, processTokenFacade, processModelFacade, identity);
  }

  protected async _executeHandler(
    token: Runtime.Types.ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    const handlerPromise: Promise<Array<Model.Base.FlowNode>> =
      new Promise<Array<Model.Base.FlowNode>>(async(resolve: Function, reject: Function): Promise<void> => {

      this.onInterruptedCallback = (): void => {
        if (this.responseSubscription) {
          this.eventAggregator.unsubscribe(this.responseSubscription);
        }
        handlerPromise.cancel();

        return;
      };

      const onResponseReceivedCallback: Function = async(): Promise<void> => {

        await this.persistOnResume(token);
        await this.persistOnExit(token);

        const nextFlowNodeInfo: Array<Model.Base.FlowNode> = processModelFacade.getNextFlowNodesFor(this.sendTask);

        return resolve(nextFlowNodeInfo);
      };

      this._waitForResponseFromReceiveTask(onResponseReceivedCallback);
      this._sendMessage(identity, token);
    });

    return handlerPromise;
  }

  /**
   * Waits for an incoming message from a ReceiveTask, acknowledging the receit of the message.
   *
   * @param callback The function to call upon receiving the message.
   */
  private _waitForResponseFromReceiveTask(callback: Function): void {

    const messageName: string = this.sendTask.messageEventDefinition.name;

    const messageEventName: string = eventAggregatorSettings
      .messagePaths
      .receiveTaskReached
      .replace(eventAggregatorSettings.messageParams.messageReference, messageName);

    this.responseSubscription = this.eventAggregator.subscribeOnce(messageEventName, () => {
      callback();
    });
  }

  /**
   * Publishes the message stored in this SendTask on the EventAggregator.
   *
   * @param identity The identity that owns the SendTask instance.
   * @param token    The current process token.
   */
  private _sendMessage(identity: IIdentity, token: Runtime.Types.ProcessToken): void {

    const messageName: string = this.sendTask.messageEventDefinition.name;

    const messageEventName: string = eventAggregatorSettings
      .messagePaths
      .sendTaskReached
      .replace(eventAggregatorSettings.messageParams.messageReference, messageName);

    const messageToSend: MessageEventReachedMessage =
      new MessageEventReachedMessage(messageName,
                                     token.correlationId,
                                     token.processModelId,
                                     token.processInstanceId,
                                     this.sendTask.id,
                                     this.flowNodeInstanceId,
                                     identity,
                                     token);

    this.eventAggregator.publish(messageEventName, messageToSend);
  }
}
