import {IEventAggregator, ISubscription} from '@essential-projects/event_aggregator_contracts';
import {IMetricsApi} from '@process-engine/metrics_api_contracts';
import {
  IExecutionContextFacade,
  IFlowNodeInstanceService,
  IProcessModelFacade,
  IProcessTokenFacade,
  MessageEventReachedMessage,
  Model,
  NextFlowNodeInfo,
  Runtime,
} from '@process-engine/process_engine_contracts';

import {FlowNodeHandler} from './index';

export class MessageBoundaryEventHandler extends FlowNodeHandler<Model.Events.BoundaryEvent> {

  private _eventAggregator: IEventAggregator;
  private _decoratedHandler: FlowNodeHandler<Model.Base.FlowNode>;

  private messageReceived: boolean = false;
  private handlerHasFinished: boolean = false;

  private subscription: ISubscription;

  constructor(eventAggregator: IEventAggregator,
              flowNodeInstanceService: IFlowNodeInstanceService,
              metricsService: IMetricsApi,
              decoratedHandler: FlowNodeHandler<Model.Base.FlowNode>) {
    super(flowNodeInstanceService, metricsService);
    this._eventAggregator = eventAggregator;
    this._decoratedHandler = decoratedHandler;
  }

  private get decoratedHandler(): FlowNodeHandler<Model.Base.FlowNode> {
    return this._decoratedHandler;
  }

  private get eventAggregator(): IEventAggregator {
    return this._eventAggregator;
  }

  // TODO: Add support for non-interrupting message events.
  protected async executeInternally(messageBoundaryEvent: Model.Events.BoundaryEvent,
                                    token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    executionContextFacade: IExecutionContextFacade): Promise<NextFlowNodeInfo> {

    return new Promise<NextFlowNodeInfo>(async(resolve: Function): Promise<void> => {

      try {
        this._subscribeToMessageEvent(resolve, messageBoundaryEvent, token, processTokenFacade, processModelFacade);

        const nextFlowNodeInfo: NextFlowNodeInfo
          = await this.decoratedHandler.execute(messageBoundaryEvent, token, processTokenFacade, processModelFacade, executionContextFacade);

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
                                         flowNode: Model.Events.BoundaryEvent,
                                         token: Runtime.Types.ProcessToken,
                                         processTokenFacade: IProcessTokenFacade,
                                         processModelFacade: IProcessModelFacade): Promise<void> {

    const messageBoundaryEvent: Model.Events.BoundaryEvent = await this._getMessageBoundaryEvent(flowNode, processModelFacade);

    const messageName: string = `/processengine/process/message/${messageBoundaryEvent.messageEventDefinition.messageRef}`;

    const messageReceivedCallback: any = async(message: MessageEventReachedMessage): Promise<void> => {

      if (this.handlerHasFinished) {
        return;
      }
      this.messageReceived = true;

      processTokenFacade.addResultForFlowNode(flowNode.id, message.tokenPayload);
      token.payload = message.tokenPayload;

      // if the message was received before the decorated handler finished execution,
      // the MessageBoundaryEvent will be used to determine the next FlowNode to execute
      const oldTokenFormat: any = await processTokenFacade.getOldTokenFormat();
      await processTokenFacade.addResultForFlowNode(messageBoundaryEvent.id, oldTokenFormat.current);

      const nextNodeAfterBoundaryEvent: Model.Base.FlowNode = processModelFacade.getNextFlowNodeFor(messageBoundaryEvent);

      const nextFlowNodeInfo: NextFlowNodeInfo = new NextFlowNodeInfo(nextNodeAfterBoundaryEvent, token, processTokenFacade);

      return resolveFunc(nextFlowNodeInfo);
    };

    this.subscription = this.eventAggregator.subscribeOnce(messageName, messageReceivedCallback);
  }

  private _getMessageBoundaryEvent(flowNode: Model.Base.FlowNode, processModelFacade: IProcessModelFacade): Model.Events.BoundaryEvent {

    const boundaryEvents: Array<Model.Events.BoundaryEvent> = processModelFacade.getBoundaryEventsFor(flowNode);

    const boundaryEvent: Model.Events.BoundaryEvent = boundaryEvents.find((currentBoundaryEvent: Model.Events.BoundaryEvent) => {
      return currentBoundaryEvent.messageEventDefinition !== undefined;
    });

    return boundaryEvent;
  }
}
