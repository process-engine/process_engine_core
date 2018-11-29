import {IEventAggregator, ISubscription} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';

import {ILoggingApi} from '@process-engine/logging_api_contracts';
import {IMetricsApi} from '@process-engine/metrics_api_contracts';
import {
  eventAggregatorSettings,
  IFlowNodeInstanceService,
  IProcessModelFacade,
  IProcessTokenFacade,
  Model,
  NextFlowNodeInfo,
  Runtime,
  SignalEventReachedMessage,
} from '@process-engine/process_engine_contracts';

import {FlowNodeHandler} from '../index';

export class SignalBoundaryEventHandler extends FlowNodeHandler<Model.Events.BoundaryEvent> {

  private _eventAggregator: IEventAggregator;
  private _decoratedHandler: FlowNodeHandler<Model.Base.FlowNode>;

  private signalReceived: boolean = false;
  private handlerHasFinished: boolean = false;

  private subscription: ISubscription;

  constructor(eventAggregator: IEventAggregator,
              flowNodeInstanceService: IFlowNodeInstanceService,
              loggingApiService: ILoggingApi,
              metricsService: IMetricsApi,
              decoratedHandler: FlowNodeHandler<Model.Base.FlowNode>,
              signalBoundaryEventModel: Model.Events.BoundaryEvent) {
    super(flowNodeInstanceService, loggingApiService, metricsService, signalBoundaryEventModel);
    this._eventAggregator = eventAggregator;
    this._decoratedHandler = decoratedHandler;
  }

  private get signalBoundaryEvent(): Model.Events.BoundaryEvent {
    return super.flowNode;
  }

  // TODO: Add support for non-interrupting signal events.
  protected async executeInternally(token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    identity: IIdentity): Promise<NextFlowNodeInfo> {

    return new Promise<NextFlowNodeInfo>(async(resolve: Function): Promise<void> => {

      try {
        this._subscribeToSignalEvent(resolve, token, processTokenFacade, processModelFacade);

        const nextFlowNodeInfo: NextFlowNodeInfo
          = await this._decoratedHandler.execute(token, processTokenFacade, processModelFacade, identity, this.previousFlowNodeInstanceId);

        if (this.signalReceived) {
          return;
        }

        // if the decorated handler finished execution before the signal was received,
        // continue the regular execution with the next FlowNode and dispose the signal subscription
        this.handlerHasFinished = true;
        resolve(nextFlowNodeInfo);
      } finally {
        if (this.subscription) {
          this.subscription.dispose();
        }
      }
    });
  }

  private async _subscribeToSignalEvent(resolveFunc: Function,
                                        token: Runtime.Types.ProcessToken,
                                        processTokenFacade: IProcessTokenFacade,
                                        processModelFacade: IProcessModelFacade): Promise<void> {

    const signalBoundaryEventName: string = eventAggregatorSettings.routePaths.signalEventReached
      .replace(eventAggregatorSettings.routeParams.signalReference, this.signalBoundaryEvent.signalEventDefinition.name);

    const signalReceivedCallback: any = async(signal: SignalEventReachedMessage): Promise<void> => {

      if (this.handlerHasFinished) {
        return;
      }
      this.signalReceived = true;

      processTokenFacade.addResultForFlowNode(this.signalBoundaryEvent.id, signal.currentToken);
      token.payload = signal.currentToken;

      // if the signal was received before the decorated handler finished execution,
      // the signalBoundaryEvent will be used to determine the next FlowNode to execute
      const oldTokenFormat: any = await processTokenFacade.getOldTokenFormat();
      await processTokenFacade.addResultForFlowNode(this.signalBoundaryEvent.id, oldTokenFormat.current);

      const nextNodeAfterBoundaryEvent: Model.Base.FlowNode = processModelFacade.getNextFlowNodeFor(this.signalBoundaryEvent);

      const nextFlowNodeInfo: NextFlowNodeInfo = new NextFlowNodeInfo(nextNodeAfterBoundaryEvent, token, processTokenFacade);

      return resolveFunc(nextFlowNodeInfo);
    };

    this.subscription = this._eventAggregator.subscribeOnce(signalBoundaryEventName, signalReceivedCallback);
  }
}
