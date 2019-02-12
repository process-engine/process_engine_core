import {Logger} from 'loggerhythm';

import {IEventAggregator} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';
import {
  eventAggregatorSettings,
  IFlowNodeHandlerFactory,
  IFlowNodePersistenceFacade,
  IProcessModelFacade,
  IProcessTokenFacade,
  Model,
  Runtime,
  SignalEventReachedMessage,
} from '@process-engine/process_engine_contracts';

import {FlowNodeHandler} from '../index';

export class IntermediateSignalThrowEventHandler extends FlowNodeHandler<Model.Events.IntermediateThrowEvent> {

  constructor(
    eventAggregator: IEventAggregator,
    flowNodeHandlerFactory: IFlowNodeHandlerFactory,
    flowNodePersistenceFacade: IFlowNodePersistenceFacade,
    signalThrowEventModel: Model.Events.IntermediateThrowEvent,
  ) {
    super(eventAggregator, flowNodeHandlerFactory, flowNodePersistenceFacade, signalThrowEventModel);
    this.logger = Logger.createLogger(`processengine:signal_throw_event_handler:${signalThrowEventModel.id}`);
  }

  private get signalThrowEvent(): Model.Events.IntermediateThrowEvent {
    return super.flowNode;
  }

  protected async executeInternally(
    token: Runtime.Types.ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    this.logger.verbose(`Executing SignalThrowEvent instance ${this.flowNodeInstanceId}.`);
    await this.persistOnEnter(token);

    return this._executeHandler(token, processTokenFacade, processModelFacade, identity);
  }

  protected async _executeHandler(
    token: Runtime.Types.ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    const signalName: string = this.signalThrowEvent.signalEventDefinition.name;

    const signalEventName: string = eventAggregatorSettings.messagePaths.signalEventReached
      .replace(eventAggregatorSettings.messageParams.signalReference, signalName);

    const message: SignalEventReachedMessage = new SignalEventReachedMessage(signalName,
                                                                             token.correlationId,
                                                                             token.processModelId,
                                                                             token.processInstanceId,
                                                                             this.signalThrowEvent.id,
                                                                             this.flowNodeInstanceId,
                                                                             identity,
                                                                             token.payload);

    this.logger.verbose(`SignalThrowEvent instance ${this.flowNodeInstanceId} now sending signal ${signalName}...`);
    this.eventAggregator.publish(signalEventName, message);
    this.logger.verbose(`Done.`);

    processTokenFacade.addResultForFlowNode(this.signalThrowEvent.id, this.flowNodeInstanceId, {});

    await this.persistOnExit(token);

    return processModelFacade.getNextFlowNodesFor(this.signalThrowEvent);
  }
}
