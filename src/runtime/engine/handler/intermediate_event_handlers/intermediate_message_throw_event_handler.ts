import {IEventAggregator} from '@essential-projects/event_aggregator_contracts';

import {IMetricsApi} from '@process-engine/metrics_api_contracts';
import {
  eventAggregatorSettings,
  IExecutionContextFacade,
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

  constructor(eventAggregator: IEventAggregator, flowNodeInstanceService: IFlowNodeInstanceService, metricsService: IMetricsApi) {
    super(flowNodeInstanceService, metricsService);
    this._eventAggregator = eventAggregator;
  }

  private get eventAggregator(): IEventAggregator {
    return this._eventAggregator;
  }

  protected async executeInternally(messageThrowEvent: Model.Events.IntermediateThrowEvent,
                                    token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    executionContextFacade: IExecutionContextFacade): Promise<NextFlowNodeInfo> {

    await this.persistOnEnter(messageThrowEvent, token);

    const intermediateMessageEventName: string = eventAggregatorSettings.routePaths.intermediateMessageEvent
      .replace(eventAggregatorSettings.routeParams.messageRef, messageThrowEvent.messageEventDefinition.messageRef);

    // TODO: Replace the message string in the contracts project with this one.
    const messageName: string = `/processengine/process/message/${messageThrowEvent.messageEventDefinition.messageRef}`;

    // TODO: reintroduce MessageEventReachedMessage
    // const payload: MessageEventReachedMessage = new MessageEventReachedMessage(messageThrowEvent.id, token);

    // this.eventAggregator.publish(intermediateMessageEventName, token);
    this.eventAggregator.publish(messageName, token);

    const nextFlowNode: Model.Base.FlowNode = processModelFacade.getNextFlowNodeFor(messageThrowEvent);

    await this.persistOnExit(messageThrowEvent, token);

    return new NextFlowNodeInfo(nextFlowNode, token, processTokenFacade);
  }
}
