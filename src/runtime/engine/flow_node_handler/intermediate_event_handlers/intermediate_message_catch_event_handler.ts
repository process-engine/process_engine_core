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

import {FlowNodeHandlerInterruptible} from '../index';

export class IntermediateMessageCatchEventHandler extends FlowNodeHandlerInterruptible<Model.Events.IntermediateCatchEvent> {

  private subscription: Subscription;

  constructor(
    eventAggregator: IEventAggregator,
    flowNodeHandlerFactory: IFlowNodeHandlerFactory,
    flowNodePersistenceFacade: IFlowNodePersistenceFacade,
    messageCatchEventModel: Model.Events.IntermediateCatchEvent,
  ) {
    super(eventAggregator, flowNodeHandlerFactory, flowNodePersistenceFacade, messageCatchEventModel);
    this.logger = Logger.createLogger(`processengine:message_catch_event_handler:${messageCatchEventModel.id}`);
  }

  private get messageCatchEvent(): Model.Events.IntermediateCatchEvent {
    return super.flowNode;
  }

  protected async executeInternally(
    token: Runtime.Types.ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    this.logger.verbose(`Executing MessageCatchEvent instance ${this.flowNodeInstanceId}.`);
    await this.persistOnEnter(token);
    await this.persistOnSuspend(token);

    return await this._executeHandler(token, processTokenFacade, processModelFacade);
  }

  protected async _continueAfterEnter(
    onEnterToken: Runtime.Types.ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
  ): Promise<Array<Model.Base.FlowNode>> {

    await this.persistOnSuspend(onEnterToken);

    return this._executeHandler(onEnterToken, processTokenFacade, processModelFacade);
  }

  protected async _continueAfterSuspend(
    flowNodeInstance: Runtime.Types.FlowNodeInstance,
    onSuspendToken: Runtime.Types.ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
  ): Promise<Array<Model.Base.FlowNode>> {

    return this._executeHandler(onSuspendToken, processTokenFacade, processModelFacade);
  }

  protected async _executeHandler(
    token: Runtime.Types.ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
  ): Promise<Array<Model.Base.FlowNode>> {

    const handlerPromise: Promise<any> = new Promise<any>(async(resolve: Function, reject: Function): Promise<void> => {

      const messageSubscriptionPromise: Promise<MessageEventReachedMessage> = this._waitForMessage();

      this.onInterruptedCallback = (interruptionToken: Runtime.Types.ProcessToken): void => {

        processTokenFacade.addResultForFlowNode(this.messageCatchEvent.id, this.flowNodeInstanceId, interruptionToken);

        if (this.subscription) {
          this.eventAggregator.unsubscribe(this.subscription);
        }

        messageSubscriptionPromise.cancel();
        handlerPromise.cancel();

        return;
      };

      const receivedMessage: MessageEventReachedMessage = await messageSubscriptionPromise;

      token.payload = receivedMessage.currentToken;
      await this.persistOnResume(token);

      processTokenFacade.addResultForFlowNode(this.messageCatchEvent.id, this.flowNodeInstanceId, receivedMessage.currentToken);
      await this.persistOnExit(token);

      const nextFlowNodeInfo: Array<Model.Base.FlowNode> = processModelFacade.getNextFlowNodesFor(this.messageCatchEvent);

      return resolve(nextFlowNodeInfo);
    });

    return handlerPromise;
  }

  private _waitForMessage(): Promise<MessageEventReachedMessage> {

    return new Promise<MessageEventReachedMessage>((resolve: Function): void => {

      const messageEventName: string = eventAggregatorSettings.messagePaths.messageEventReached
        .replace(eventAggregatorSettings.messageParams.messageReference, this.messageCatchEvent.messageEventDefinition.name);

      this.subscription =
        this.eventAggregator.subscribeOnce(messageEventName, async(message: MessageEventReachedMessage) => {
          this.logger.verbose(
            `MessageCatchEvent instance ${this.flowNodeInstanceId} message ${messageEventName} received:`,
            message,
            'Resuming execution.',
          );

          return resolve(message);
        });
      this.logger.verbose(`MessageCatchEvent instance ${this.flowNodeInstanceId} waiting for message ${messageEventName}.`);
    });
  }
}
