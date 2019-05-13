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

import {EventHandler} from './index';

export class IntermediateMessageCatchEventHandler extends EventHandler<Model.Events.IntermediateCatchEvent> {

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
    return this.flowNode;
  }

  protected async executeInternally(
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    this.logger.verbose(`Executing MessageCatchEvent instance ${this.flowNodeInstanceId}.`);
    await this.persistOnEnter(token);

    return this.executeHandler(token, processTokenFacade, processModelFacade);
  }

  protected async executeHandler(
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
  ): Promise<Array<Model.Base.FlowNode>> {

    const handlerPromise = new Promise<any>(async (resolve: Function, reject: Function): Promise<void> => {

      this.onInterruptedCallback = (interruptionToken: ProcessToken): void => {

        if (this.subscription) {
          this.eventAggregator.unsubscribe(this.subscription);
        }

        processTokenFacade.addResultForFlowNode(this.messageCatchEvent.id, this.flowNodeInstanceId, interruptionToken);

        handlerPromise.cancel();

        return undefined;
      };

      const receivedMessage = await this.suspendAndWaitForMessage(token);

      token.payload = receivedMessage.currentToken;
      await this.persistOnResume(token);

      processTokenFacade.addResultForFlowNode(this.messageCatchEvent.id, this.flowNodeInstanceId, receivedMessage.currentToken);
      await this.persistOnExit(token);

      const nextFlowNodeInfo = processModelFacade.getNextFlowNodesFor(this.messageCatchEvent);

      return resolve(nextFlowNodeInfo);
    });

    return handlerPromise;
  }

  protected async continueAfterSuspend(
    flowNodeInstance: FlowNodeInstance,
    onSuspendToken: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
  ): Promise<Array<Model.Base.FlowNode>> {

    const handlerPromise = new Promise<any>(async (resolve: Function, reject: Function): Promise<void> => {

      this.onInterruptedCallback = (interruptionToken: ProcessToken): void => {

        if (this.subscription) {
          this.eventAggregator.unsubscribe(this.subscription);
        }

        processTokenFacade.addResultForFlowNode(this.messageCatchEvent.id, this.flowNodeInstanceId, interruptionToken);

        handlerPromise.cancel();

        return undefined;
      };

      const receivedMessage = await this.waitForMessage();

      onSuspendToken.payload = receivedMessage.currentToken;
      await this.persistOnResume(onSuspendToken);

      processTokenFacade.addResultForFlowNode(this.messageCatchEvent.id, this.flowNodeInstanceId, receivedMessage.currentToken);
      await this.persistOnExit(onSuspendToken);

      const nextFlowNodeInfo = processModelFacade.getNextFlowNodesFor(this.messageCatchEvent);

      return resolve(nextFlowNodeInfo);
    });

    return handlerPromise;
  }

  private async suspendAndWaitForMessage(token: ProcessToken): Promise<MessageEventReachedMessage> {
    const waitForMessagePromise = this.waitForMessage();
    await this.persistOnSuspend(token);

    return waitForMessagePromise;
  }

  private async waitForMessage(): Promise<MessageEventReachedMessage> {

    return new Promise<MessageEventReachedMessage>((resolve: Function): void => {

      const messageEventName = eventAggregatorSettings.messagePaths.messageEventReached
        .replace(eventAggregatorSettings.messageParams.messageReference, this.messageCatchEvent.messageEventDefinition.name);

      this.subscription =
        this.eventAggregator.subscribeOnce(messageEventName, (message: MessageEventReachedMessage): void => {
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
