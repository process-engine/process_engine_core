import {IEventAggregator, ISubscription} from '@essential-projects/event_aggregator_contracts';

import {IMetricsService} from '@process-engine/metrics_api_contracts';
import {
  IExecutionContextFacade,
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

  constructor(eventAggregator: IEventAggregator, flowNodeInstanceService: IFlowNodeInstanceService, metricsService: IMetricsService) {
    super(flowNodeInstanceService, metricsService);
    this._eventAggregator = eventAggregator;
  }

  private get eventAggregator(): IEventAggregator {
    return this._eventAggregator;
  }

  protected async executeInternally(messageCatchEvent: Model.Events.IntermediateCatchEvent,
                                    token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    executionContextFacade: IExecutionContextFacade): Promise<NextFlowNodeInfo> {

    await this.persistOnEnter(messageCatchEvent, token);
    await this.persistOnSuspend(messageCatchEvent, token);

    const receivedMessage: MessageEventReachedMessage = await this._waitForMessage(messageCatchEvent.messageEventDefinition.messageRef);

    processTokenFacade.addResultForFlowNode(messageCatchEvent.id, receivedMessage.tokenPayload);
    token.payload = receivedMessage.tokenPayload;

    await this.persistOnResume(messageCatchEvent, token);

    const nextFlowNodeInfo: Model.Base.FlowNode = processModelFacade.getNextFlowNodeFor(messageCatchEvent);

    await this.persistOnExit(messageCatchEvent, token);

    return new NextFlowNodeInfo(nextFlowNodeInfo, token, processTokenFacade);
  }

  private async _waitForMessage(messageReference: string): Promise<MessageEventReachedMessage> {

    return new Promise<MessageEventReachedMessage>((resolve: Function): void => {

      const messageName: string = `/processengine/process/message/${messageReference}`;

      const subscription: ISubscription = this.eventAggregator.subscribeOnce(messageName, async(message: MessageEventReachedMessage) => {

        if (subscription) {
          subscription.dispose();
        }

        return resolve(message);
      });
    });
  }
}
