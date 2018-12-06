import {Logger} from 'loggerhythm';

import {InternalServerError} from '@essential-projects/errors_ts';
import {IEventAggregator, ISubscription} from '@essential-projects/event_aggregator_contracts';
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

export class IntermediateMessageCatchEventHandler extends FlowNodeHandler<Model.Events.IntermediateCatchEvent> {

  private _eventAggregator: IEventAggregator;

  constructor(eventAggregator: IEventAggregator,
              flowNodeInstanceService: IFlowNodeInstanceService,
              loggingService: ILoggingApi,
              metricsService: IMetricsApi,
              messageCatchEventModel: Model.Events.IntermediateCatchEvent) {
    super(flowNodeInstanceService, loggingService, metricsService, messageCatchEventModel);
    this._eventAggregator = eventAggregator;
    this.logger = Logger.createLogger(`processengine:message_catch_event_handler:${messageCatchEventModel.id}`);
  }

  private get messageCatchEvent(): Model.Events.IntermediateCatchEvent {
    return super.flowNode;
  }

  protected async executeInternally(token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    identity: IIdentity): Promise<NextFlowNodeInfo> {

    this.logger.verbose(`Executing MessageCatchEvent instance ${this.flowNodeInstanceId}.`);
    await this.persistOnEnter(token);
    await this.persistOnSuspend(token);

    return await this._executeHandler(token, processTokenFacade, processModelFacade);
  }

  protected async resumeInternally(flowNodeInstance: Runtime.Types.FlowNodeInstance,
                                   processTokenFacade: IProcessTokenFacade,
                                   processModelFacade: IProcessModelFacade,
                                   identity: IIdentity,
                                 ): Promise<NextFlowNodeInfo> {

    this.logger.verbose(`Resuming MessageCatchEvent instance ${flowNodeInstance.id}`);

    switch (flowNodeInstance.state) {
      case Runtime.Types.FlowNodeInstanceState.suspended:
        this.logger.verbose(`MessageCatchEvent ${flowNodeInstance.id} was left suspended. Waiting for the Message to be received.`);
        const suspendToken: Runtime.Types.ProcessToken = flowNodeInstance.getTokenByType(Runtime.Types.ProcessTokenType.onSuspend);

        return this._continueAfterSuspend(flowNodeInstance, suspendToken, processTokenFacade, processModelFacade);

      case Runtime.Types.FlowNodeInstanceState.running:
        const resumeToken: Runtime.Types.ProcessToken = flowNodeInstance.getTokenByType(Runtime.Types.ProcessTokenType.onResume);

        const messageNotYetReceived: boolean = resumeToken === undefined;
        if (messageNotYetReceived) {
          this.logger.verbose(`MessageCatchEvent ${flowNodeInstance.id} was interrupted at the beginning. Resuming from the start.`);
          const onEnterToken: Runtime.Types.ProcessToken = flowNodeInstance.getTokenByType(Runtime.Types.ProcessTokenType.onEnter);

          return this._continueAfterEnter(onEnterToken, processTokenFacade, processModelFacade);
        }

        this.logger.verbose(`MessageCatchEvent ${flowNodeInstance.id} already received its message. Finishing up the handler.`);

        return this._continueAfterResume(resumeToken, processTokenFacade, processModelFacade);

      case Runtime.Types.FlowNodeInstanceState.finished:
        this.logger.verbose(`MessageCatchEvent ${flowNodeInstance.id} was already finished. Skipping ahead.`);
        const onExitToken: Runtime.Types.ProcessToken = flowNodeInstance.getTokenByType(Runtime.Types.ProcessTokenType.onExit);

        return this._continueAfterExit(onExitToken, processTokenFacade, processModelFacade);

      case Runtime.Types.FlowNodeInstanceState.error:
        this.logger.error(`Cannot resume MessageCatchEvent instance ${flowNodeInstance.id}, because it previously exited with an error!`,
                     flowNodeInstance.error);
        throw flowNodeInstance.error;

      case Runtime.Types.FlowNodeInstanceState.terminated:
        const terminatedError: string = `Cannot resume MessageCatchEvent instance ${flowNodeInstance.id}, because it was terminated!`;
        this.logger.error(terminatedError);
        throw new InternalServerError(terminatedError);

      default:
        const invalidStateError: string = `Cannot resume MessageCatchEvent instance ${flowNodeInstance.id}, because its state cannot be determined!`;
        this.logger.error(invalidStateError);
        throw new InternalServerError(invalidStateError);
    }
  }

  protected async _continueAfterEnter(onEnterToken: Runtime.Types.ProcessToken,
                                      processTokenFacade: IProcessTokenFacade,
                                      processModelFacade: IProcessModelFacade,
                                     ): Promise<NextFlowNodeInfo> {

    await this.persistOnSuspend(onEnterToken);

    return this._executeHandler(onEnterToken, processTokenFacade, processModelFacade);
  }

  protected async _continueAfterSuspend(flowNodeInstance: Runtime.Types.FlowNodeInstance,
                                        onSuspendToken: Runtime.Types.ProcessToken,
                                        processTokenFacade: IProcessTokenFacade,
                                        processModelFacade: IProcessModelFacade,
                                      ): Promise<NextFlowNodeInfo> {

    return this._executeHandler(onSuspendToken, processTokenFacade, processModelFacade);
  }

  protected async _executeHandler(token: Runtime.Types.ProcessToken,
                                  processTokenFacade: IProcessTokenFacade,
                                  processModelFacade: IProcessModelFacade): Promise<NextFlowNodeInfo> {

    const receivedMessage: MessageEventReachedMessage = await this._waitForMessage();

    token.payload = receivedMessage.currentToken;
    await this.persistOnResume(token);

    processTokenFacade.addResultForFlowNode(this.messageCatchEvent.id, receivedMessage.currentToken);
    await this.persistOnExit(token);

    const nextFlowNodeInfo: Model.Base.FlowNode = processModelFacade.getNextFlowNodeFor(this.messageCatchEvent);

    return new NextFlowNodeInfo(nextFlowNodeInfo, token, processTokenFacade);
  }

  private async _waitForMessage(): Promise<MessageEventReachedMessage> {

    return new Promise<MessageEventReachedMessage>((resolve: Function): void => {

      const messageEventName: string = eventAggregatorSettings.routePaths.messageEventReached
        .replace(eventAggregatorSettings.routeParams.messageReference, this.messageCatchEvent.messageEventDefinition.name);

      const subscription: ISubscription = this._eventAggregator.subscribeOnce(messageEventName, async(message: MessageEventReachedMessage) => {

        if (subscription) {
          subscription.dispose();
        }
        this.logger.verbose(
          `MessageCatchEvent instance ${this.flowNodeInstanceId} message ${messageEventName} received:`,
          message,
          'Resuming execution.',
        );

        return resolve(message);
      });
      this.logger.verbose(`MessageCatchEvent instance ${this.flowNodeInstanceId} waiting for message ${messageEventName}.`);
    });
  }
}
