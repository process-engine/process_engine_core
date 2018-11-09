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

export class SendTaskHandler extends FlowNodeHandler<Model.Activities.SendTask> {
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
    console.log(`THIS IS THE NOT PUBLISHED IMPLEMENTATION111111111111111111111`);

    const noMessageDefinitionProvided: boolean = sendTaskActivity.messageEventDefinition === undefined;
    if (noMessageDefinitionProvided) {
      throw new Error('SendTask has no MessageDefinition!');
    }

    await this._registerEventHandlerAndSendMessage(sendTaskActivity.messageEventDefinition.name, sendTaskActivity.id, token);

    const nextFlowNodeInfo: Model.Base.FlowNode = processModelFacade.getNextFlowNodeFor(sendTaskActivity);
    await this.persistOnExit(sendTaskActivity, token);

    return new NextFlowNodeInfo(nextFlowNodeInfo, token, processTokenFacade);
  }

  private _sendMessage(messageName: string,
                             sendTaskFlowNodeId: string,
                             token: Runtime.Types.ProcessToken): void {

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

  private async _registerEventHandlerAndSendMessage(messageName: string, sendTaskFlowNodeId: string, token: Runtime.Types.ProcessToken): Promise<void> {
    const doneSendingPromise: Promise<void> = new Promise((resolve: Function, reject: Function): void => {
      const messageEventName: string = eventAggregatorSettings
      .routePaths
      .receiveTaskReached
      .replace(eventAggregatorSettings.routeParams.messageReference, messageName);

     const subscription: ISubscription = this._eventAggregator.subscribeOnce(messageEventName, async(message: MessageEventReachedMessage) => {
        if (subscription) {
          subscription.dispose();
        }

        resolve(message);
      });

      this._sendMessage(messageName, sendTaskFlowNodeId, token);
    });

    return doneSendingPromise;
  }
}
