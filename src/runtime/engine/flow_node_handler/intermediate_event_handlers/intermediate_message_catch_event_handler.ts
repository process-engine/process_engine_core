import * as Bluebird from 'bluebird';
import {Logger} from 'loggerhythm';

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

import {FlowNodeHandlerInterruptable} from '../index';

export class IntermediateMessageCatchEventHandler extends FlowNodeHandlerInterruptable<Model.Events.IntermediateCatchEvent> {

  private _eventAggregator: IEventAggregator;
  private subscription: ISubscription;

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

    const handlerPromise: Bluebird<any> = new Bluebird<any>(async(resolve: Function, reject: Function): Promise<void> => {

      const messageSubscriptionPromise: Bluebird<MessageEventReachedMessage> = this._waitForMessage();

      this.onInterruptedCallback = (interruptionToken: Runtime.Types.ProcessToken): void => {

        processTokenFacade.addResultForFlowNode(this.messageCatchEvent.id, interruptionToken);

        if (this.subscription) {
          this.subscription.dispose();
        }

        messageSubscriptionPromise.cancel();
        handlerPromise.cancel();

        return;
      };

      const receivedMessage: MessageEventReachedMessage = await messageSubscriptionPromise;

      token.payload = receivedMessage.currentToken;
      await this.persistOnResume(token);

      processTokenFacade.addResultForFlowNode(this.messageCatchEvent.id, receivedMessage.currentToken);
      await this.persistOnExit(token);

      const nextFlowNodeInfo: NextFlowNodeInfo = await this.getNextFlowNodeInfo(token, processTokenFacade, processModelFacade);

      return resolve(nextFlowNodeInfo);
    });

    return handlerPromise;
  }

  private _waitForMessage(): Bluebird<MessageEventReachedMessage> {

    return new Bluebird<MessageEventReachedMessage>((resolve: Function): void => {

      const messageEventName: string = eventAggregatorSettings.routePaths.messageEventReached
        .replace(eventAggregatorSettings.routeParams.messageReference, this.messageCatchEvent.messageEventDefinition.name);

      this.subscription = this._eventAggregator.subscribeOnce(messageEventName, async(message: MessageEventReachedMessage) => {

        if (this.subscription) {
          this.subscription.dispose();
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
