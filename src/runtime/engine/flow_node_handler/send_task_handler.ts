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

class SendTaskHandler extends FlowNodeHandler<Model.Activities.SendTask> {
  private _eventAggregator: IEventAggregator;

  constructor(eventAggregator: IEventAggregator,
              flowNodeInstanceService: IFlowNodeInstanceService,
              loggingService: ILoggingApi,
              metricsService: IMetricsApi) {
    super(flowNodeInstanceService, loggingService, metricsService);
    this._eventAggregator = eventAggregator;
  }

  private get eventAggregator(): IEventAggregator {
    return this._eventAggregator;
  }

  protected async executeInternally(sendTaskActivity: Model.Activities.SendTask,
                                    token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    identity: IIdentity): Promise<NextFlowNodeInfo> {
    await this.persistOnEnter(sendTaskActivity, token);

    const messageDefinitonUnset: boolean = sendTaskActivity.messageEventDefinition !== undefined;
    if (messageDefinitonUnset) {
      throw new Error('Message definition unset.');
    }

    /**
     * Before we want to send the message to the Receive task we need to
     * subscribe to it.
     *
     * This ensures, that the confirmations does not get lost.
     */
    const confirmationPromise: Promise<MessageEventReachedMessage> =
      this._waitForConfirmationMessage(sendTaskActivity.messageEventDefinition.name);

    await this._sendMessage(sendTaskActivity.messageEventDefinition.name, sendTaskActivity.id, token);

    await confirmationPromise;

    const nextFlowNodeInfo: Model.Base.FlowNode = processModelFacade.getNextFlowNodeFor(sendTaskActivity);
    await this.persistOnExit(sendTaskActivity, token);

    return new NextFlowNodeInfo(nextFlowNodeInfo, token, processTokenFacade);
  }

  private async _sendMessage(messageName: string,
                             sendTaskFlowNodeId: string,
                             token: Runtime.Types.ProcessToken): Promise<void> {

    const messageEventName: string =
      eventAggregatorSettings
      .routePaths
      .sendTaskReached
      .replace(eventAggregatorSettings.routeParams.messageReference, messageName);

    const messageToSend: MessageEventReachedMessage = new MessageEventReachedMessage(
                                                                    messageName,
                                                                    token.correlationId,
                                                                    token.processModelId,
                                                                    token.processInstanceId,
                                                                    sendTaskFlowNodeId,
                                                                    token.payload);
    this._eventAggregator.publish(messageEventName, messageToSend);
  }

  private async _waitForConfirmationMessage(messageToWaitFor: string): Promise<MessageEventReachedMessage> {
    const messageReceivedPromise: Promise<MessageEventReachedMessage> = new Promise<MessageEventReachedMessage>((resolve: Function): void => {
     const messageEventName: string = eventAggregatorSettings
      .routePaths
      .sendTaskReceived
      .replace(eventAggregatorSettings.routeParams.messageReference, messageToWaitFor);

     const subscription: ISubscription = this._eventAggregator.subscribeOnce(messageEventName, async(message: MessageEventReachedMessage) => {
        if (subscription) {
          subscription.dispose();
        }

        resolve(message);
      });
    });

    return messageReceivedPromise;
  }
}
