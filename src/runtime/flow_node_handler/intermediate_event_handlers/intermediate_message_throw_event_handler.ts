import {Logger} from 'loggerhythm';

import {IEventAggregator} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';

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

import {FlowNodeHandler} from '../index';

export class IntermediateMessageThrowEventHandler extends FlowNodeHandler<Model.Events.IntermediateThrowEvent> {

  constructor(
    eventAggregator: IEventAggregator,
    flowNodeHandlerFactory: IFlowNodeHandlerFactory,
    flowNodePersistenceFacade: IFlowNodePersistenceFacade,
    messageThrowEventModel: Model.Events.IntermediateThrowEvent,
  ) {
    super(eventAggregator, flowNodeHandlerFactory, flowNodePersistenceFacade, messageThrowEventModel);
    this.logger = Logger.createLogger(`processengine:message_throw_event_handler:${messageThrowEventModel.id}`);
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
  }
}
