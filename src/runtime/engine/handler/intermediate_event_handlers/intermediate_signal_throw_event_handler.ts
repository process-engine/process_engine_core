import {IEventAggregator} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';

import {IMetricsApi} from '@process-engine/metrics_api_contracts';
import {
  IFlowNodeInstanceService,
  IProcessModelFacade,
  IProcessTokenFacade,
  Model,
  NextFlowNodeInfo,
  Runtime,
  SignalEventReachedMessage,
  eventAggregatorSettings,
} from '@process-engine/process_engine_contracts';

import {FlowNodeHandler} from '../index';

export class IntermediateSignalThrowEventHandler extends FlowNodeHandler<Model.Events.IntermediateThrowEvent> {

  private _eventAggregator: IEventAggregator;

  constructor(eventAggregator: IEventAggregator, flowNodeInstanceService: IFlowNodeInstanceService, metricsService: IMetricsApi) {
    super(flowNodeInstanceService, metricsService);
    this._eventAggregator = eventAggregator;
  }

  private get eventAggregator(): IEventAggregator {
    return this._eventAggregator;
  }

  protected async executeInternally(flowNode: Model.Events.IntermediateThrowEvent,
                                    token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    identity: IIdentity): Promise<NextFlowNodeInfo> {

    await this.persistOnEnter(flowNode, token);

    const signalReference: string = flowNode.signalEventDefinition.signalRef;
    
    const signalEventName: string = eventAggregatorSettings.routePaths.signalEventReached
      .replace(eventAggregatorSettings.routeParams.signalReference, signalReference);

    const message: SignalEventReachedMessage = new SignalEventReachedMessage(signalReference,
                                                                               token.correlationId,
                                                                               token.processModelId,
                                                                               token.processInstanceId,
                                                                               flowNode.id,
                                                                               token.payload);

    this.eventAggregator.publish(signalEventName, message);

    const nextFlowNode: Model.Base.FlowNode = processModelFacade.getNextFlowNodeFor(flowNode);

    await this.persistOnExit(flowNode, token);

    return new NextFlowNodeInfo(nextFlowNode, token, processTokenFacade);
  }
}
