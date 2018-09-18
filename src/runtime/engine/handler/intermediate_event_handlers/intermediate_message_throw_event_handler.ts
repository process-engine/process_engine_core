import {
  IExecutionContextFacade,
  IFlowNodeInstanceService,
  IProcessModelFacade,
  IProcessTokenFacade,
  MessageEndEventReachedMessage,
  Model,
  NextFlowNodeInfo,
  Runtime,
} from '@process-engine/process_engine_contracts';

import {IEventAggregator} from '@essential-projects/event_aggregator_contracts';

import {FlowNodeHandler} from '../index';

export class IntermediateMessageThrowEventHandler extends FlowNodeHandler<Model.Events.IntermediateThrowEvent> {

  private _eventAggregator: IEventAggregator;
  private _flowNodeInstanceService: IFlowNodeInstanceService = undefined;

  constructor(flowNodeInstanceService: IFlowNodeInstanceService, eventAggregator: IEventAggregator) {
    super();
    this._eventAggregator = eventAggregator;
    this._flowNodeInstanceService = flowNodeInstanceService;
  }

  private get eventAggregator(): IEventAggregator {
    return this._eventAggregator;
  }

  private get flowNodeInstanceService(): IFlowNodeInstanceService {
    return this._flowNodeInstanceService;
  }

  protected async executeInternally(flowNode: Model.Events.IntermediateThrowEvent,
                                    token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    executionContextFacade: IExecutionContextFacade): Promise<NextFlowNodeInfo> {

    await this.flowNodeInstanceService.persistOnEnter(flowNode.id, this.flowNodeInstanceId, token);

    const messageName: string = `/processengine/process/message/${flowNode.messageEventDefinition.messageRef}`;
    const payload: MessageEndEventReachedMessage = new MessageEndEventReachedMessage(flowNode.id, token);

    this.eventAggregator.publish(messageName, payload);

    const nextFlowNode: Model.Base.FlowNode = processModelFacade.getNextFlowNodeFor(flowNode);

    await this.flowNodeInstanceService.persistOnExit(flowNode.id, this.flowNodeInstanceId, token);

    return new NextFlowNodeInfo(nextFlowNode, token, processTokenFacade);
  }
}
