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
              metricsService: IMetricsApi,
              messageThrowEventModel: Model.Events.IntermediateThrowEvent) {
    super(flowNodeInstanceService, loggingService, metricsService, messageThrowEventModel);
    this._eventAggregator = eventAggregator;
  }

  private get messageThrowEvent(): Model.Events.IntermediateThrowEvent {
    return super.flowNode;
  }

  protected async executeInternally(token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    identity: IIdentity): Promise<NextFlowNodeInfo> {

    await this.persistOnEnter(token);

    const messageName: string = this.messageThrowEvent.messageEventDefinition.name;

    const messageEventName: string = eventAggregatorSettings.routePaths.messageEventReached
      .replace(eventAggregatorSettings.routeParams.messageReference, messageName);

    const message: MessageEventReachedMessage = new MessageEventReachedMessage(messageName,
                                                                               token.correlationId,
                                                                               token.processModelId,
                                                                               token.processInstanceId,
                                                                               this.messageThrowEvent.id,
                                                                               token.payload);

    this._eventAggregator.publish(messageEventName, message);

    const nextFlowNode: Model.Base.FlowNode = processModelFacade.getNextFlowNodeFor(this.messageThrowEvent);

    await this.persistOnExit(token);

    return new NextFlowNodeInfo(nextFlowNode, token, processTokenFacade);
  }

  public async resumeInternally(flowNodeInstance: Runtime.Types.FlowNodeInstance,
                                processTokenFacade: IProcessTokenFacade,
                                processModelFacade: IProcessModelFacade,
                                identity: IIdentity,
                              ): Promise<NextFlowNodeInfo> {

    throw new Error('Not implemented yet.');
  }
}
