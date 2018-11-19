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

export class ReceiveTaskHandler extends FlowNodeHandler<Model.Activities.ReceiveTask> {
  private _eventAggregator: IEventAggregator;

  constructor(eventAggregator: IEventAggregator,
              flowNodeInstanceService: IFlowNodeInstanceService,
              loggingService: ILoggingApi,
              metricsService: IMetricsApi,
              receiveTaskModel: Model.Activities.ReceiveTask) {
    super(flowNodeInstanceService, loggingService, metricsService, receiveTaskModel);
    this._eventAggregator = eventAggregator;
  }

  private get receiveTask(): Model.Activities.ReceiveTask {
    return super.flowNode;
  }

  protected async executeInternally(token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    identity: IIdentity): Promise<NextFlowNodeInfo> {

    await this.persistOnEnter(token);

    const noMessageDefinitionProvided: boolean = this.receiveTask.messageEventDefinition === undefined;
    if (noMessageDefinitionProvided) {
      throw new UnprocessableEntityError('SendTask has no MessageDefinition!');
    }

    await this.persistOnSuspend(token);
    const receivedMessage: MessageEventReachedMessage = await this._waitForMessage();
    await this.persistOnResume(token);

    await this._sendReplyToSender(token);

    processTokenFacade.addResultForFlowNode(this.receiveTask.id, receivedMessage.currentToken);
    const nextFlowNodeInfo: Model.Base.FlowNode = processModelFacade.getNextFlowNodeFor(this.receiveTask);
    await this.persistOnExit(receivedMessage.currentToken);

    return new NextFlowNodeInfo(nextFlowNodeInfo, token, processTokenFacade);
  }

  public async resumeInternally(flowNodeInstance: Runtime.Types.FlowNodeInstance,
                                processTokenFacade: IProcessTokenFacade,
                                processModelFacade: IProcessModelFacade,
                                identity: IIdentity,
                              ): Promise<NextFlowNodeInfo> {

    throw new Error('Not implemented yet.');
  }

  private async _waitForMessage(): Promise<MessageEventReachedMessage> {

    return new Promise<MessageEventReachedMessage>((resolve: Function): void => {

      const messageEventName: string = eventAggregatorSettings
        .routePaths
        .sendTaskReached
        .replace(eventAggregatorSettings.routeParams.messageReference, this.receiveTask.messageEventDefinition.name);

      const subscription: ISubscription = this._eventAggregator.subscribeOnce(messageEventName, async(message: MessageEventReachedMessage) => {

        if (subscription) {
          subscription.dispose();
        }

        resolve(message);
      });
    });
  }

  private async _sendReplyToSender(token: Runtime.Types.ProcessToken): Promise<void> {

    const messageName: string = this.receiveTask.messageEventDefinition.name;

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
      this.receiveTask.id,
      token.payload);

    this._eventAggregator.publish(messageEventName, messageToSend);
  }
}
