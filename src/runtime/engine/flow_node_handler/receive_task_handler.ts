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

import {FlowNodeHandler} from './index';

export class ReceiveTaskHandler extends FlowNodeHandler<Model.Activities.ReceiveTask> {
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

  protected async executeInternally(receiveTaskActivity: Model.Activities.SendTask,
                                    token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    identity: IIdentity): Promise<NextFlowNodeInfo> {

    await this.persistOnEnter(receiveTaskActivity, token);

    const noMessageDefinitionProvided: boolean = receiveTaskActivity.messageEventDefinition === undefined;
    if (noMessageDefinitionProvided) {
      throw new Error('SendTask has no MessageDefinition!');
    }

    const receivedMessage: MessageEventReachedMessage = await this._waitForMessage(receiveTaskActivity.messageEventDefinition.name);
    await this._sendReplyToSender(receiveTaskActivity.messageEventDefinition.name, receiveTaskActivity.id, token);

    processTokenFacade.addResultForFlowNode(receiveTaskActivity.id, receivedMessage.currentToken);
    const nextFlowNodeInfo: Model.Base.FlowNode = processModelFacade.getNextFlowNodeFor(receiveTaskActivity);
    await this.persistOnExit(receiveTaskActivity, receivedMessage.currentToken);

    return new NextFlowNodeInfo(nextFlowNodeInfo, token, processTokenFacade);
  }

  private async _sendReplyToSender(messageName: string,
                                   sendTaskFlowNodeId: string,
                                   token: Runtime.Types.ProcessToken): Promise<void> {

    const messageEventName: string =
      eventAggregatorSettings
        .routePaths
        .receiveTaskReached
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

  private async _waitForMessage(messageToWaitFor: string): Promise<MessageEventReachedMessage> {
    const messageReceivedPromise: Promise<MessageEventReachedMessage> = new Promise<MessageEventReachedMessage>((resolve: Function): void => {
      const messageEventName: string = eventAggregatorSettings
        .routePaths
        .sendTaskReached
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
