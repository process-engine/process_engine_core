import {IContainer} from 'addict-ioc';
import {Logger} from 'loggerhythm';

import {IIdentity} from '@essential-projects/iam_contracts';
import {
  eventAggregatorSettings,
  IProcessModelFacade,
  IProcessTokenFacade,
  MessageEventReachedMessage,
  Model,
  Runtime,
} from '@process-engine/process_engine_contracts';

import {FlowNodeHandler} from '../index';

export class IntermediateMessageThrowEventHandler extends FlowNodeHandler<Model.Events.IntermediateThrowEvent> {

  constructor(container: IContainer, messageThrowEventModel: Model.Events.IntermediateThrowEvent) {
    super(container, messageThrowEventModel);
    this.logger = Logger.createLogger(`processengine:message_throw_event_handler:${messageThrowEventModel.id}`);
  }

  private get messageThrowEvent(): Model.Events.IntermediateThrowEvent {
    return super.flowNode;
  }

  protected async executeInternally(
    token: Runtime.Types.ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    this.logger.verbose(`Executing MessageThrowEvent instance ${this.flowNodeInstanceId}.`);
    await this.persistOnEnter(token);

    return this._executeHandler(token, processTokenFacade, processModelFacade, identity);
  }

  protected async _executeHandler(
    token: Runtime.Types.ProcessToken,
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
    this.eventAggregator.publish(messageEventName, message);
    this.logger.verbose(`Done.`);

    await this.persistOnExit(token);

    return processModelFacade.getNextFlowNodesFor(this.messageThrowEvent);
  }
}
