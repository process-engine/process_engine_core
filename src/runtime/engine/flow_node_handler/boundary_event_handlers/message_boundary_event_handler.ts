import {IEventAggregator, Subscription} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';

import {ILoggingApi} from '@process-engine/logging_api_contracts';
import {IMetricsApi} from '@process-engine/metrics_api_contracts';
import {
  eventAggregatorSettings,
  IFlowNodeInstanceService,
  IProcessModelFacade,
  IProcessTokenFacade,
  MessageEventReachedMessage,
  Model,
  NextFlowNodeInfo,
  Runtime,
} from '@process-engine/process_engine_contracts';

import {FlowNodeHandlerInterruptible} from '../index';

export class MessageBoundaryEventHandler extends FlowNodeHandlerInterruptible<Model.Events.BoundaryEvent> {

  private _eventAggregator: IEventAggregator;
  private _decoratedHandler: FlowNodeHandlerInterruptible<Model.Base.FlowNode>;

  private messageReceived: boolean = false;
  private handlerHasFinished: boolean = false;

  private handlerPromise: Promise<NextFlowNodeInfo>;
  private subscription: Subscription;

  constructor(eventAggregator: IEventAggregator,
              flowNodeInstanceService: IFlowNodeInstanceService,
              loggingApiService: ILoggingApi,
              metricsService: IMetricsApi,
              decoratedHandler: FlowNodeHandlerInterruptible<Model.Base.FlowNode>,
              messageBoundaryEventModel: Model.Events.BoundaryEvent) {
    super(flowNodeInstanceService, loggingApiService, metricsService, messageBoundaryEventModel);
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
    this._decoratedHandler.interrupt(token, terminate);
  }

  // TODO: Add support for non-interrupting message events.
  protected async executeInternally(token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    identity: IIdentity): Promise<NextFlowNodeInfo> {

    this.handlerPromise = new Promise<NextFlowNodeInfo>(async(resolve: Function): Promise<void> => {

      this._subscribeToMessageEvent(resolve, token, processTokenFacade, processModelFacade);

      const nextFlowNodeInfo: NextFlowNodeInfo
        = await this._decoratedHandler.execute(token, processTokenFacade, processModelFacade, identity, this.previousFlowNodeInstanceId);

      this.handlerHasFinished = true;

      if (this.messageReceived) {
        return;
      }

      this._eventAggregator.unsubscribe(this.subscription);

      // if the decorated handler finished execution before the message was received,
      // continue the regular execution with the next FlowNode and dispose the message subscription
      return resolve(nextFlowNodeInfo);
    });

    return this.handlerPromise;
  }

  protected async resumeInternally(flowNodeInstance: Runtime.Types.FlowNodeInstance,
                                   processTokenFacade: IProcessTokenFacade,
                                   processModelFacade: IProcessModelFacade,
                                   identity: IIdentity,
                                  ): Promise<NextFlowNodeInfo> {

    this.handlerPromise = new Promise<NextFlowNodeInfo>(async(resolve: Function): Promise<void> => {

      const onEnterToken: Runtime.Types.ProcessToken = flowNodeInstance.getTokenByType(Runtime.Types.ProcessTokenType.onEnter);

      this._subscribeToMessageEvent(resolve, onEnterToken, processTokenFacade, processModelFacade);

      const nextFlowNodeInfo: NextFlowNodeInfo
        = await this._decoratedHandler.resume(flowNodeInstance, processTokenFacade, processModelFacade, identity);

      this.handlerHasFinished = true;

      if (this.messageReceived) {
        return;
      }

      this._eventAggregator.unsubscribe(this.subscription);

      // if the decorated handler finished execution before the message was received,
      // continue the regular execution with the next FlowNode and dispose the message subscription
      return resolve(nextFlowNodeInfo);
    });

    return this.handlerPromise;
  }

  private _subscribeToMessageEvent(resolveFunc: Function,
                                   token: Runtime.Types.ProcessToken,
                                   processTokenFacade: IProcessTokenFacade,
                                   processModelFacade: IProcessModelFacade): void {

    const messageBoundaryEventName: string = eventAggregatorSettings.messagePaths.messageEventReached
      .replace(eventAggregatorSettings.messageParams.messageReference, this.messageBoundaryEvent.messageEventDefinition.name);

    const messageReceivedCallback: any = (message: MessageEventReachedMessage): void => {

      this.messageReceived = true;

      if (this.handlerHasFinished) {
        return;
      }
      token.payload = message.currentToken;
      this._decoratedHandler.interrupt(token);

      // if the message was received before the decorated handler finished execution,
      // the MessageBoundaryEvent will be used to determine the next FlowNode to execute
      const decoratedFlowNodeId: string = this._decoratedHandler.getFlowNode().id;
      processTokenFacade.addResultForFlowNode(decoratedFlowNodeId, token.payload);
      processTokenFacade.addResultForFlowNode(this.messageBoundaryEvent.id, token.payload);

      const nextNodeAfterBoundaryEvent: Model.Base.FlowNode = processModelFacade.getNextFlowNodeFor(this.messageBoundaryEvent);

      const nextFlowNodeInfo: NextFlowNodeInfo = new NextFlowNodeInfo(nextNodeAfterBoundaryEvent, token, processTokenFacade);

      return resolveFunc(nextFlowNodeInfo);
    };

    this.subscription = this._eventAggregator.subscribeOnce(messageBoundaryEventName, messageReceivedCallback);
  }
}
