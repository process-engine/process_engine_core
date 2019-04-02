import {Logger} from 'loggerhythm';

import {InternalServerError} from '@essential-projects/errors_ts';
import {IEventAggregator} from '@essential-projects/event_aggregator_contracts';
import {IIAMService, IIdentity} from '@essential-projects/iam_contracts';

import {ProcessToken} from '@process-engine/flow_node_instance.contracts';
import {
  eventAggregatorSettings,
  IFlowNodeHandlerFactory,
  IFlowNodePersistenceFacade,
  IProcessModelFacade,
  IProcessTokenFacade,
  MessageEventReachedMessage,
} from '@process-engine/process_engine_contracts';
import {Model} from '@process-engine/process_model.contracts';

import {EventHandler} from './index';

export class IntermediateMessageThrowEventHandler extends EventHandler<Model.Events.IntermediateThrowEvent> {

  private readonly _iamService: IIAMService;

  constructor(
    eventAggregator: IEventAggregator,
    flowNodeHandlerFactory: IFlowNodeHandlerFactory,
    flowNodePersistenceFacade: IFlowNodePersistenceFacade,
    iamService: IIAMService,
    messageThrowEventModel: Model.Events.IntermediateThrowEvent,
  ) {
    super(eventAggregator, flowNodeHandlerFactory, flowNodePersistenceFacade, messageThrowEventModel);
    this.logger = Logger.createLogger(`processengine:message_throw_event_handler:${messageThrowEventModel.id}`);
    this._iamService = iamService;
  }

  private get messageThrowEvent(): Model.Events.IntermediateThrowEvent {
    return super.flowNode;
  }

  protected async executeInternally(
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    this.logger.verbose(`Executing MessageThrowEvent instance ${this.flowNodeInstanceId}.`);
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

      token.payload = this._getTokenPayloadFromInputValues(token, processTokenFacade, identity);

      const messageName: string = this.messageThrowEvent.messageEventDefinition.name;

      const messageEventName: string = eventAggregatorSettings.messagePaths.messageEventReached
        .replace(eventAggregatorSettings.messageParams.messageReference, messageName);

      const message: MessageEventReachedMessage = new MessageEventReachedMessage(messageName,
                                                                                 token.correlationId,
                                                                                 token.processModelId,
                                                                                 token.processInstanceId,
                                                                                 this.messageThrowEvent.id,
                                                                                 this.flowNodeInstanceId,
                                                                                 identity,
                                                                                 token.payload);

      this.logger.verbose(`MessageThrowEvent instance ${this.flowNodeInstanceId} now sending message ${messageName}...`);
      // Message-specific notification
      this.eventAggregator.publish(messageEventName, message);
      // General notification
      this.eventAggregator.publish(eventAggregatorSettings.messagePaths.messageTriggered, message);
      this.logger.verbose(`Done.`);

      processTokenFacade.addResultForFlowNode(this.messageThrowEvent.id, this.flowNodeInstanceId, {});

      await this.persistOnExit(token);

      return processModelFacade.getNextFlowNodesFor(this.messageThrowEvent);
    } catch (error) {
      this.logger.error(`Failed to send message: ${error.message}`);

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
  private _getTokenPayloadFromInputValues(token: ProcessToken, processTokenFacade: IProcessTokenFacade, identity: IIdentity): any {

    try {
      const eventUsesDefaultPayload: boolean = this.messageThrowEvent.inputValues === undefined;

      if (eventUsesDefaultPayload) {
        return token.payload;
      }

      const tokenHistory: any = processTokenFacade.getOldTokenFormat();

      const evaluatePayloadFunction: Function = new Function('token', 'identity', `return ${this.messageThrowEvent.inputValues}`);

      return evaluatePayloadFunction.call(tokenHistory, tokenHistory, identity);
    } catch (error) {
      const errorMessage: string = `MessageThrowEvent configuration for inputValues '${this.messageThrowEvent.inputValues}' is invalid!`;
      this.logger.error(errorMessage);

      throw new InternalServerError(errorMessage);
    }
  }
}
