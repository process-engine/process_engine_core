import {IEventAggregator, ISubscription} from '@essential-projects/event_aggregator_contracts';
import {
  IExecutionContextFacade,
  IProcessModelFacade,
  IProcessTokenFacade,
  Model,
  NextFlowNodeInfo,
  Runtime,
} from '@process-engine/process_engine_contracts';

import {FlowNodeHandler} from './index';

export class MessageBoundaryEventHandler extends FlowNodeHandler<Model.Events.BoundaryEvent> {

  private _eventAggregator: IEventAggregator;
  private _decoratedHandler: FlowNodeHandler<Model.Base.FlowNode>;

  constructor(eventAggregator: IEventAggregator, decoratedHandler: FlowNodeHandler<Model.Base.FlowNode>) {
    super();
    this._eventAggregator = eventAggregator;
    this._decoratedHandler = decoratedHandler;
  }

  private get decoratedHandler(): FlowNodeHandler<Model.Base.FlowNode> {
    return this._decoratedHandler;
  }

  private get eventAggregator(): IEventAggregator {
    return this._eventAggregator;
  }

  protected async executeInternally(flowNode: Model.Events.BoundaryEvent,
                                    token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    executionContextFacade: IExecutionContextFacade): Promise<NextFlowNodeInfo> {

    const messageBoundaryEvent: Model.Events.BoundaryEvent = await this._getMessageBoundaryEvent(flowNode, processModelFacade);

    const nextFlowNodeInfo: NextFlowNodeInfo
      = await this.decoratedHandler.execute(flowNode, token, processTokenFacade, processModelFacade, executionContextFacade);

    return new Promise<NextFlowNodeInfo>((resolve: Function): void => {

      const messageName: string =
        `/processengine/process/${token.processInstanceId}/message/${messageBoundaryEvent.messageEventDefinition.messageReference}`;

      const subscription: ISubscription = this.eventAggregator.subscribeOnce(messageName, (message: any) => {
        return resolve(nextFlowNodeInfo);
      });

      if (subscription) {
        subscription.dispose();
      }
    });
  }

  private _getMessageBoundaryEvent(flowNode: Model.Base.FlowNode, processModelFacade: IProcessModelFacade): Model.Events.BoundaryEvent {

    const boundaryEvents: Array<Model.Events.BoundaryEvent> = processModelFacade.getBoundaryEventsFor(flowNode);

    const boundaryEvent: Model.Events.BoundaryEvent = boundaryEvents.find((currentBoundaryEvent: Model.Events.BoundaryEvent) => {
      return currentBoundaryEvent.messageEventDefinition !== undefined;
    });

    return boundaryEvent;
  }
}
