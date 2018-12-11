import {IEventAggregator, ISubscription} from '@essential-projects/event_aggregator_contracts';
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

import {ActivityHandler, FlowNodeHandler} from '../index';

export class MessageBoundaryEventHandler extends FlowNodeHandler<Model.Events.BoundaryEvent> {

  private _eventAggregator: IEventAggregator;
  private _decoratedHandler: ActivityHandler<Model.Base.FlowNode>;

  private messageReceived: boolean = false;
  private handlerHasFinished: boolean = false;

  private subscription: ISubscription;

  constructor(eventAggregator: IEventAggregator,
              flowNodeInstanceService: IFlowNodeInstanceService,
              loggingApiService: ILoggingApi,
              metricsService: IMetricsApi,
              decoratedHandler: ActivityHandler<Model.Base.FlowNode>,
              messageBoundaryEventModel: Model.Events.BoundaryEvent) {
    super(flowNodeInstanceService, loggingApiService, metricsService, messageBoundaryEventModel);
    this._eventAggregator = eventAggregator;
    this._decoratedHandler = decoratedHandler;
  }

  private get messageBoundaryEvent(): Model.Events.BoundaryEvent {
    return super.flowNode;
  }

  // TODO: Add support for non-interrupting message events.
  protected async executeInternally(token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    identity: IIdentity): Promise<NextFlowNodeInfo> {

    return new Promise<NextFlowNodeInfo>(async(resolve: Function): Promise<void> => {

      try {
        this._subscribeToMessageEvent(resolve, token, processTokenFacade, processModelFacade);

        const nextFlowNodeInfo: NextFlowNodeInfo
          = await this._decoratedHandler.execute(token, processTokenFacade, processModelFacade, identity, this.previousFlowNodeInstanceId);

        if (this.messageReceived) {
          return;
        }

        // if the decorated handler finished execution before the message was received,
        // continue the regular execution with the next FlowNode and dispose the message subscription
        this.handlerHasFinished = true;
        resolve(nextFlowNodeInfo);
      } finally {
        if (this.subscription) {
          this.subscription.dispose();
        }
      }
    });
  }

  protected async resumeInternally(flowNodeInstance: Runtime.Types.FlowNodeInstance,
                                   processTokenFacade: IProcessTokenFacade,
                                   processModelFacade: IProcessModelFacade,
                                   identity: IIdentity,
                                  ): Promise<NextFlowNodeInfo> {

    return new Promise<NextFlowNodeInfo>(async(resolve: Function): Promise<void> => {

      const onEnterToken: Runtime.Types.ProcessToken = flowNodeInstance.getTokenByType(Runtime.Types.ProcessTokenType.onEnter);

      try {
        this._subscribeToMessageEvent(resolve, onEnterToken, processTokenFacade, processModelFacade);

        const nextFlowNodeInfo: NextFlowNodeInfo
          = await this._decoratedHandler.resume(flowNodeInstance, processTokenFacade, processModelFacade, identity);

        if (this.messageReceived) {
          return;
        }

        // if the decorated handler finished execution before the message was received,
        // continue the regular execution with the next FlowNode and dispose the message subscription
        this.handlerHasFinished = true;
        resolve(nextFlowNodeInfo);
      } finally {
        if (this.subscription) {
          this.subscription.dispose();
        }
      }
    });
  }

  private async _subscribeToMessageEvent(resolveFunc: Function,
                                         token: Runtime.Types.ProcessToken,
                                         processTokenFacade: IProcessTokenFacade,
                                         processModelFacade: IProcessModelFacade): Promise<void> {

    const messageBoundaryEventName: string = eventAggregatorSettings.routePaths.messageEventReached
      .replace(eventAggregatorSettings.routeParams.messageReference, this.messageBoundaryEvent.messageEventDefinition.name);

    const messageReceivedCallback: any = async(message: MessageEventReachedMessage): Promise<void> => {

      if (this.handlerHasFinished) {
        return;
      }
      this.messageReceived = true;
      token.payload = message.currentToken;
      this._decoratedHandler.interrupt(token);

      // if the message was received before the decorated handler finished execution,
      // the MessageBoundaryEvent will be used to determine the next FlowNode to execute
      await processTokenFacade.addResultForFlowNode(this.messageBoundaryEvent.id, token.payload);

      const nextNodeAfterBoundaryEvent: Model.Base.FlowNode = processModelFacade.getNextFlowNodeFor(this.messageBoundaryEvent);

      const nextFlowNodeInfo: NextFlowNodeInfo = new NextFlowNodeInfo(nextNodeAfterBoundaryEvent, token, processTokenFacade);

      return resolveFunc(nextFlowNodeInfo);
    };

    this.subscription = this._eventAggregator.subscribeOnce(messageBoundaryEventName, messageReceivedCallback);
  }
}
