import {Logger} from 'loggerhythm';

import {IEventAggregator} from '@essential-projects/event_aggregator_contracts';
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

export class IntermediateSignalThrowEventHandler extends FlowNodeHandler<Model.Events.IntermediateThrowEvent> {

  private _eventAggregator: IEventAggregator;

  constructor(eventAggregator: IEventAggregator,
              flowNodeInstanceService: IFlowNodeInstanceService,
              loggingService: ILoggingApi,
              metricsService: IMetricsApi,
              signalThrowEventModel: Model.Events.IntermediateThrowEvent) {
    super(flowNodeInstanceService, loggingService, metricsService, signalThrowEventModel);
    this._eventAggregator = eventAggregator;
    this.logger = Logger.createLogger(`processengine:signal_throw_event_handler:${signalThrowEventModel.id}`);
  }

  private get signalThrowEvent(): Model.Events.IntermediateThrowEvent {
    return super.flowNode;
  }

  protected async executeInternally(token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    identity: IIdentity): Promise<NextFlowNodeInfo> {

    this.logger.verbose(`Executing SignalThrowEvent instance ${this.flowNodeInstanceId}.`);
    await this.persistOnEnter(token);

    return this._executeHandler(token, processTokenFacade, processModelFacade);
  }

  protected async _executeHandler(token: Runtime.Types.ProcessToken,
                                  processTokenFacade: IProcessTokenFacade,
                                  processModelFacade: IProcessModelFacade): Promise<NextFlowNodeInfo> {

    const signalName: string = this.signalThrowEvent.signalEventDefinition.name;

    const signalEventName: string = eventAggregatorSettings.routePaths.signalEventReached
      .replace(eventAggregatorSettings.routeParams.signalReference, signalName);

    const message: SignalEventReachedMessage = new SignalEventReachedMessage(signalName,
                                                                             token.correlationId,
                                                                             token.processModelId,
                                                                             token.processInstanceId,
                                                                             this.signalThrowEvent.id,
                                                                             token.payload);

    this.logger.verbose(`SignalThrowEvent instance ${this.flowNodeInstanceId} now sending signal ${signalName}...`);
    this._eventAggregator.publish(signalEventName, message);
    this.logger.verbose(`Done.`);

    await this.persistOnExit(token);

    return this.getNextFlowNodeInfo(token, processTokenFacade, processModelFacade);
  }
}
