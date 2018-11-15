import {UnprocessableEntityError} from '@essential-projects/errors_ts';
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
              metricsService: IMetricsApi,
              sendTaskModel: Model.Activities.SendTask) {
    super(flowNodeInstanceService, loggingService, metricsService, sendTaskModel);
    this._eventAggregator = eventAggregator;
  }

  private get sendTask(): Model.Activities.SendTask {
    return super.flowNode;
  }

  protected async executeInternally(token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    identity: IIdentity): Promise<NextFlowNodeInfo> {
    await this.persistOnEnter(token);

    const noMessageDefinitionProvided: boolean = this.sendTask.messageEventDefinition === undefined;
    if (noMessageDefinitionProvided) {
      throw new UnprocessableEntityError('SendTask has no MessageDefinition!');
    }

    await this._registerEventHandlerAndSendMessage(token);

    const nextFlowNodeInfo: Model.Base.FlowNode = processModelFacade.getNextFlowNodeFor(this.sendTask);
    await this.persistOnExit(token);

    return new NextFlowNodeInfo(nextFlowNodeInfo, token, processTokenFacade);
  }

  private async _registerEventHandlerAndSendMessage(token: Runtime.Types.ProcessToken): Promise<void> {

    return new Promise<void>((resolve: Function, reject: Function): void => {
      const messageName: string = this.sendTask.messageEventDefinition.name;

      const messageEventName: string = eventAggregatorSettings
        .routePaths
        .receiveTaskReached
        .replace(eventAggregatorSettings.routeParams.messageReference, messageName);

      const subscription: ISubscription = this._eventAggregator.subscribeOnce(messageEventName, async(message: MessageEventReachedMessage) => {

        await this.persistOnResume(token);

        if (subscription) {
          subscription.dispose();
        }

        resolve(message);
      });

      this._sendMessage(messageName, token);
    });
  }

  private async _sendMessage(messageName: string, token: Runtime.Types.ProcessToken): Promise<void> {

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
                                                                    this.sendTask.id,
                                                                    token);

    this._eventAggregator.publish(messageEventName, messageToSend);

    await this.persistOnSuspend(token);
  }
}
