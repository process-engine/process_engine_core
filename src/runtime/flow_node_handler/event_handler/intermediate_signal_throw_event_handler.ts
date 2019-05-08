import {Logger} from 'loggerhythm';

import {InternalServerError} from '@essential-projects/errors_ts';
import {IEventAggregator} from '@essential-projects/event_aggregator_contracts';
import {IIAMService, IIdentity} from '@essential-projects/iam_contracts';

import {ProcessToken} from '@process-engine/flow_node_instance.contracts';
import {
  IFlowNodeHandlerFactory,
  IFlowNodePersistenceFacade,
  IProcessModelFacade,
  IProcessTokenFacade,
  SignalEventReachedMessage,
  eventAggregatorSettings,
} from '@process-engine/process_engine_contracts';
import {Model} from '@process-engine/process_model.contracts';

import {EventHandler} from './index';

export class IntermediateSignalThrowEventHandler extends EventHandler<Model.Events.IntermediateThrowEvent> {

  private readonly iamService: IIAMService;

  constructor(
    eventAggregator: IEventAggregator,
    flowNodeHandlerFactory: IFlowNodeHandlerFactory,
    flowNodePersistenceFacade: IFlowNodePersistenceFacade,
    iamService: IIAMService,
    signalThrowEventModel: Model.Events.IntermediateThrowEvent,
  ) {
    super(eventAggregator, flowNodeHandlerFactory, flowNodePersistenceFacade, signalThrowEventModel);
    this.logger = Logger.createLogger(`processengine:signal_throw_event_handler:${signalThrowEventModel.id}`);
    this.iamService = iamService;
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

    return this.executeHandler(token, processTokenFacade, processModelFacade, identity);
  }

  protected async executeHandler(
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    try {
      await this.ensureHasClaim(identity, processModelFacade);

      token.payload = this.getTokenPayloadFromInputValues(token, processTokenFacade, identity);

      const signalName = this.signalThrowEvent.signalEventDefinition.name;

      const signalEventName = eventAggregatorSettings.messagePaths.signalEventReached
        .replace(eventAggregatorSettings.messageParams.signalReference, signalName);

      const message = new SignalEventReachedMessage(
        signalName,
        token.correlationId,
        token.processModelId,
        token.processInstanceId,
        this.signalThrowEvent.id,
        this.flowNodeInstanceId,
        identity,
        token.payload,
      );

      this.logger.verbose(`SignalThrowEvent instance ${this.flowNodeInstanceId} now sending signal ${signalName}...`);
      // Signal-specific notification
      this.eventAggregator.publish(signalEventName, message);
      // General notification
      this.eventAggregator.publish(eventAggregatorSettings.messagePaths.signalTriggered, message);
      this.logger.verbose('Done.');

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

  private async ensureHasClaim(identity: IIdentity, processModelFacade: IProcessModelFacade): Promise<void> {

    const processModelHasNoLanes = !processModelFacade.getProcessModelHasLanes();
    if (processModelHasNoLanes) {
      return;
    }

    const laneForFlowNode = processModelFacade.getLaneForFlowNode(this.flowNode.id);
    const claimName = laneForFlowNode.name;

    await this.iamService.ensureHasClaim(identity, claimName);
  }

  /**
   * Retrives the payload to use with the event.
   *
   * This will either be expression contained in the `inputValues` property
   * of the FlowNode, if it exists, or the current token.
   *
   * @param   token              The current ProcessToken.
   * @param   processTokenFacade The facade for handling all ProcessTokens.
   * @param   identity           The requesting users identity.
   * @returns                    The retrieved payload for the event.
   */
  private getTokenPayloadFromInputValues(token: ProcessToken, processTokenFacade: IProcessTokenFacade, identity: IIdentity): any {

    try {
      const eventUsesDefaultPayload = this.signalThrowEvent.inputValues === undefined;
      if (eventUsesDefaultPayload) {
        return token.payload;
      }

      const tokenHistory = processTokenFacade.getOldTokenFormat();

      const evaluatePayloadFunction = new Function('token', 'identity', `return ${this.signalThrowEvent.inputValues}`);

      return evaluatePayloadFunction.call(tokenHistory, tokenHistory, identity);
    } catch (error) {
      const errorMessage = `MessageThrowEvent configuration for inputValues '${this.signalThrowEvent.inputValues}' is invalid!`;
      this.logger.error(errorMessage);

      throw new InternalServerError(errorMessage);
    }
  }

}
