import {IContainer} from 'addict-ioc';

import {IEventAggregator, Subscription} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';
import {
  eventAggregatorSettings,
  IProcessModelFacade,
  IProcessTokenFacade,
  MessageEventReachedMessage,
  Model,
  Runtime,
} from '@process-engine/process_engine_contracts';

import {FlowNodeHandlerInterruptible} from '../index';

export class MessageBoundaryEventHandler extends FlowNodeHandlerInterruptible<Model.Events.BoundaryEvent> {

  private _eventAggregator: IEventAggregator;
  private _decoratedHandler: FlowNodeHandlerInterruptible<Model.Base.FlowNode>;

  private messageReceived: boolean = false;
  private handlerHasFinished: boolean = false;

  private handlerPromise: Promise<Model.Base.FlowNode>;
  private subscription: Subscription;

  constructor(
    container: IContainer,
    eventAggregator: IEventAggregator,
    decoratedHandler: FlowNodeHandlerInterruptible<Model.Base.FlowNode>,
    messageBoundaryEventModel: Model.Events.BoundaryEvent,
  ) {
    super(container, messageBoundaryEventModel);
    this._eventAggregator = eventAggregator;
    this._decoratedHandler = decoratedHandler;
  }

  private get messageBoundaryEvent(): Model.Events.BoundaryEvent {
    return super.flowNode;
  }

  public async interrupt(token: Runtime.Types.ProcessToken, terminate?: boolean): Promise<void> {

    if (this.subscription) {
      this._eventAggregator.unsubscribe(this.subscription);
    }
    this.handlerPromise.cancel();

    return this._decoratedHandler.interrupt(token, terminate);
  }

  // TODO: Add support for non-interrupting message events.
  protected async executeInternally(
    token: Runtime.Types.ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Model.Base.FlowNode> {

    this.handlerPromise = new Promise<Model.Base.FlowNode>(async(resolve: Function): Promise<void> => {

      this._subscribeToMessageEvent(resolve, token, processTokenFacade, processModelFacade);

      await this._decoratedHandler.execute(token, processTokenFacade, processModelFacade, identity, this.previousFlowNodeInstanceId);

      this.handlerHasFinished = true;

      if (this.messageReceived) {
        return;
      }

      this._eventAggregator.unsubscribe(this.subscription);

      // if the decorated handler finished execution before the message was received,
      // continue the regular execution with the next FlowNode and dispose the message subscription
      const nextFlowNodeAfterDecoratedHandler: Model.Base.FlowNode = this._getFlowNodeAfterDecoratedHandler(processModelFacade);

      return resolve(nextFlowNodeAfterDecoratedHandler);
    });

    return this.handlerPromise;
  }

  protected async resumeInternally(
    flowNodeInstance: Runtime.Types.FlowNodeInstance,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
    flowNodeInstances: Array<Runtime.Types.FlowNodeInstance>,
  ): Promise<Model.Base.FlowNode> {

    this.handlerPromise = new Promise<Model.Base.FlowNode>(async(resolve: Function): Promise<void> => {

      const onEnterToken: Runtime.Types.ProcessToken = flowNodeInstance.getTokenByType(Runtime.Types.ProcessTokenType.onEnter);

      this._subscribeToMessageEvent(resolve, onEnterToken, processTokenFacade, processModelFacade);

      await this._decoratedHandler.resume(flowNodeInstances, processTokenFacade, processModelFacade, identity);

      this.handlerHasFinished = true;

      if (this.messageReceived) {
        return;
      }

      this._eventAggregator.unsubscribe(this.subscription);

      // if the decorated handler finished execution before the message was received,
      // continue the regular execution with the next FlowNode and dispose the message subscription
      const nextFlowNodeAfterDecoratedHandler: Model.Base.FlowNode = this._getFlowNodeAfterDecoratedHandler(processModelFacade);

      return resolve(nextFlowNodeAfterDecoratedHandler);
    });

    return this.handlerPromise;
  }

  private _subscribeToMessageEvent(
    resolveFunc: Function,
    token: Runtime.Types.ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
  ): void {

    const messageBoundaryEventName: string = eventAggregatorSettings.messagePaths.messageEventReached
      .replace(eventAggregatorSettings.messageParams.messageReference, this.messageBoundaryEvent.messageEventDefinition.name);

    const messageReceivedCallback: any = async(message: MessageEventReachedMessage): Promise<void> => {

      this.messageReceived = true;

      if (this.handlerHasFinished) {
        return;
      }
      token.payload = message.currentToken;

      await this._decoratedHandler.interrupt(token);

      // if the message was received before the decorated handler finished execution,
      // the MessageBoundaryEvent will be used to determine the next FlowNode to execute
      const decoratedFlowNodeId: string = this._decoratedHandler.getFlowNode().id;
      processTokenFacade.addResultForFlowNode(decoratedFlowNodeId, token.payload);
      processTokenFacade.addResultForFlowNode(this.messageBoundaryEvent.id, token.payload);

      const nextNodeAfterBoundaryEvent: Model.Base.FlowNode = processModelFacade.getNextFlowNodeFor(this.messageBoundaryEvent);

      return resolveFunc(nextNodeAfterBoundaryEvent);
    };

    this.subscription = this._eventAggregator.subscribeOnce(messageBoundaryEventName, messageReceivedCallback);
  }

  private _getFlowNodeAfterDecoratedHandler(processModelFacade: IProcessModelFacade): Model.Base.FlowNode {
    const decoratedHandlerFlowNode: Model.Base.FlowNode = this._decoratedHandler.getFlowNode();

    return processModelFacade.getNextFlowNodeFor(decoratedHandlerFlowNode);
  }
}
