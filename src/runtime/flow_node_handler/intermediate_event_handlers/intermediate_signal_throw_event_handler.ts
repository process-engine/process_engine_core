import {Logger} from 'loggerhythm';

import {IEventAggregator} from '@essential-projects/event_aggregator_contracts';
import {IIAMService, IIdentity} from '@essential-projects/iam_contracts';

import {ProcessToken} from '@process-engine/flow_node_instance.contracts';
import {
  eventAggregatorSettings,
  IFlowNodeHandlerFactory,
  IFlowNodePersistenceFacade,
  IProcessModelFacade,
  IProcessTokenFacade,
  SignalEventReachedMessage,
} from '@process-engine/process_engine_contracts';
import {Model} from '@process-engine/process_model.contracts';

import {FlowNodeHandler} from '../index';

export class IntermediateSignalThrowEventHandler extends FlowNodeHandler<Model.Events.IntermediateThrowEvent> {

  private readonly _iamService: IIAMService;

  constructor(
    eventAggregator: IEventAggregator,
    flowNodeHandlerFactory: IFlowNodeHandlerFactory,
    flowNodePersistenceFacade: IFlowNodePersistenceFacade,
    iamService: IIAMService,
    signalThrowEventModel: Model.Events.IntermediateThrowEvent,
  ) {
    super(eventAggregator, flowNodeHandlerFactory, flowNodePersistenceFacade, signalThrowEventModel);
    this.logger = Logger.createLogger(`processengine:signal_throw_event_handler:${signalThrowEventModel.id}`);
    this._iamService = iamService;
  }

  private get signalThrowEvent(): Model.Events.IntermediateThrowEvent {
    return super.flowNode;
  }

  protected async executeInternally(
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    this.logger.verbose(`Executing SignalThrowEvent instance ${this.flowNodeInstanceId}.`);
    await this.persistOnEnter(token);

    return this._executeHandler(token, processTokenFacade, processModelFacade, identity);
  }

  protected async _executeHandler(
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    try {
      await this._ensureHasClaim(identity, processModelFacade);

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
      // Signal-specific notification
      this.eventAggregator.publish(signalEventName, message);
      // General notification
      this.eventAggregator.publish(eventAggregatorSettings.messagePaths.signalTriggered, message);
      this.logger.verbose(`Done.`);

      processTokenFacade.addResultForFlowNode(this.signalThrowEvent.id, this.flowNodeInstanceId, {});

      await this.persistOnExit(token);

      return processModelFacade.getNextFlowNodesFor(this.signalThrowEvent);
    } catch (error) {
      this.logger.error(`Failed to send signal: ${error.message}`);

      token.payload = {};

      this.persistOnError(token, error);

      throw error;
    }
  }

  private async _ensureHasClaim(identity: IIdentity, processModelFacade: IProcessModelFacade): Promise<void> {

    const processModelHasNoLanes: boolean = !processModelFacade.getProcessModelHasLanes();
    if (processModelHasNoLanes) {
      return;
    }

    const laneForFlowNode: Model.ProcessElements.Lane = processModelFacade.getLaneForFlowNode(this.flowNode.id);
    const claimName: string = laneForFlowNode.name;

    await this._iamService.ensureHasClaim(identity, claimName);
  }
}
