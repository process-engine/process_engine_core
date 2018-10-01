import {IEventAggregator} from '@essential-projects/event_aggregator_contracts';
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

import {FlowNodeHandler} from '../index';

export class IntermediateMessageThrowEventHandler extends FlowNodeHandler<Model.Events.IntermediateThrowEvent> {

  private _eventAggregator: IEventAggregator;

  constructor(eventAggregator: IEventAggregator,
              flowNodeInstanceService: IFlowNodeInstanceService,
              loggingService: ILoggingApi,
              metricsService: IMetricsApi) {
    super(flowNodeInstanceService, loggingService, metricsService);
    this._eventAggregator = eventAggregator;
  }

  private get eventAggregator(): IEventAggregator {
    return this._eventAggregator;
  }

  protected async executeInternally(messageThrowEvent: Model.Events.IntermediateThrowEvent,
                                    token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    identity: IIdentity): Promise<NextFlowNodeInfo> {

    await this.persistOnEnter(messageThrowEvent, token);

    const messageReference: string = messageThrowEvent.messageEventDefinition.messageRef;

    const messageEventName: string = eventAggregatorSettings.routePaths.messageEventReached
      .replace(eventAggregatorSettings.routeParams.messageReference, messageReference);

    const message: MessageEventReachedMessage = new MessageEventReachedMessage(messageReference,
                                                                               token.correlationId,
                                                                               token.processModelId,
                                                                               token.processInstanceId,
                                                                               messageThrowEvent.id,
                                                                               token.payload);

    this.eventAggregator.publish(messageEventName, message);

    const nextFlowNode: Model.Base.FlowNode = processModelFacade.getNextFlowNodeFor(messageThrowEvent);

    await this.persistOnExit(messageThrowEvent, token);

    return new NextFlowNodeInfo(nextFlowNode, token, processTokenFacade);
  }
}
