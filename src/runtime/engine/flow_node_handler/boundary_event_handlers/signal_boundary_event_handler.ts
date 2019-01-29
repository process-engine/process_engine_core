import {IContainer} from 'addict-ioc';

import {IEventAggregator, Subscription} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';
import {
  eventAggregatorSettings,
  IProcessModelFacade,
  IProcessTokenFacade,
  Model,
  NextFlowNodeInfo,
  Runtime,
  SignalEventReachedMessage,
} from '@process-engine/process_engine_contracts';

import {FlowNodeHandlerInterruptible} from '../index';

export class SignalBoundaryEventHandler extends FlowNodeHandlerInterruptible<Model.Events.BoundaryEvent> {

  private _eventAggregator: IEventAggregator;
  private _decoratedHandler: FlowNodeHandlerInterruptible<Model.Base.FlowNode>;

  private signalReceived: boolean = false;
  private handlerHasFinished: boolean = false;

  private handlerPromise: Promise<Model.Base.FlowNode>;
  private subscription: Subscription;

  constructor(
    container: IContainer,
    eventAggregator: IEventAggregator,
    decoratedHandler: FlowNodeHandlerInterruptible<Model.Base.FlowNode>,
    signalBoundaryEventModel: Model.Events.BoundaryEvent,
  ) {
    super(container, signalBoundaryEventModel);
    this._eventAggregator = eventAggregator;
    this._decoratedHandler = decoratedHandler;
  }

  private get signalBoundaryEvent(): Model.Events.BoundaryEvent {
    return super.flowNode;
  }

  public async interrupt(token: Runtime.Types.ProcessToken, terminate?: boolean): Promise<void> {

    if (this.subscription) {
      this._eventAggregator.unsubscribe(this.subscription);
    }
    this.handlerPromise.cancel();

    return this._decoratedHandler.interrupt(token, terminate);
  }

  // TODO: Add support for non-interrupting signal events.
  protected async executeInternally(
    token: Runtime.Types.ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Model.Base.FlowNode> {

    this.handlerPromise = new Promise<Model.Base.FlowNode>(async(resolve: Function): Promise<void> => {

      this._subscribeToSignalEvent(resolve, token, processTokenFacade, processModelFacade);

      await this._decoratedHandler.execute(token, processTokenFacade, processModelFacade, identity, this.previousFlowNodeInstanceId);

      this.handlerHasFinished = true;

      if (this.signalReceived) {
        return;
      }

      this._eventAggregator.unsubscribe(this.subscription);

      // if the decorated handler finished execution before the signal was received,
      // continue the regular execution with the next FlowNode and dispose the signal subscription
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
  ): Promise<Model.Base.FlowNode> {

    this.handlerPromise = new Promise<Model.Base.FlowNode>(async(resolve: Function): Promise<void> => {

      const onEnterToken: Runtime.Types.ProcessToken = flowNodeInstance.tokens[0];

      this._subscribeToSignalEvent(resolve, onEnterToken, processTokenFacade, processModelFacade);

      await this._decoratedHandler.resume(flowNodeInstance, processTokenFacade, processModelFacade, identity);

      this.handlerHasFinished = true;

      if (this.signalReceived) {
        return;
      }

      this._eventAggregator.unsubscribe(this.subscription);

      // if the decorated handler finished execution before the signal was received,
      // continue the regular execution with the next FlowNode and dispose the signal subscription
      const nextFlowNodeAfterDecoratedHandler: Model.Base.FlowNode = this._getFlowNodeAfterDecoratedHandler(processModelFacade);

      return resolve(nextFlowNodeAfterDecoratedHandler);
    });

    return this.handlerPromise;
  }

  private _subscribeToSignalEvent(resolveFunc: Function,
                                  token: Runtime.Types.ProcessToken,
                                  processTokenFacade: IProcessTokenFacade,
                                  processModelFacade: IProcessModelFacade): void {

    const signalBoundaryEventName: string = eventAggregatorSettings.messagePaths.signalEventReached
      .replace(eventAggregatorSettings.messageParams.signalReference, this.signalBoundaryEvent.signalEventDefinition.name);

    const signalReceivedCallback: any = async(signal: SignalEventReachedMessage): Promise<void> => {
      if (this.handlerHasFinished) {
        return;
      }
      this.signalReceived = true;
      token.payload = signal.currentToken;

      await this._decoratedHandler.interrupt(token);

      // if the signal was received before the decorated handler finished execution,
      // the signalBoundaryEvent will be used to determine the next FlowNode to execute
      const decoratedFlowNodeId: string = this._decoratedHandler.getFlowNode().id;
      processTokenFacade.addResultForFlowNode(decoratedFlowNodeId, token.payload);
      processTokenFacade.addResultForFlowNode(this.signalBoundaryEvent.id, token.payload);

      const nextNodeAfterBoundaryEvent: Model.Base.FlowNode = processModelFacade.getNextFlowNodeFor(this.signalBoundaryEvent);

      const nextFlowNodeInfo: NextFlowNodeInfo = new NextFlowNodeInfo(nextNodeAfterBoundaryEvent, token, processTokenFacade);

      return resolveFunc(nextFlowNodeInfo);
    };

    this.subscription = this._eventAggregator.subscribeOnce(signalBoundaryEventName, signalReceivedCallback);
  }

  private _getFlowNodeAfterDecoratedHandler(processModelFacade: IProcessModelFacade): Model.Base.FlowNode {
    const decoratedHandlerFlowNode: Model.Base.FlowNode = this._decoratedHandler.getFlowNode();

    return processModelFacade.getNextFlowNodeFor(decoratedHandlerFlowNode);
  }
}
