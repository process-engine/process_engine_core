import {
  IExecutionContextFacade,
  IFlowNodeInstanceService,
  IProcessModelFacade,
  IProcessTokenFacade,
  Model,
  NextFlowNodeInfo,
  Runtime,
} from '@process-engine/process_engine_contracts';

import {IEventAggregator, ISubscription} from '@essential-projects/event_aggregator_contracts';

import {FlowNodeHandler} from '../index';

export class IntermediateMessageCatchEventHandler extends FlowNodeHandler<Model.Events.IntermediateCatchEvent> {

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

  protected async executeInternally(flowNode: Model.Events.IntermediateCatchEvent,
                                    token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    executionContextFacade: IExecutionContextFacade): Promise<NextFlowNodeInfo> {

    await this.flowNodeInstanceService.persistOnEnter(executionContextFacade, token, flowNode.id, this.flowNodeInstanceId);
    await this.flowNodeInstanceService.suspend(executionContextFacade, token, this.flowNodeInstanceId);

    await this._waitForMessage(token.processInstanceId, flowNode.messageEventDefinition.messageRef);

    await this.flowNodeInstanceService.resume(executionContextFacade, this.flowNodeInstanceId);

    const nextFlowNodeInfo: Model.Base.FlowNode = processModelFacade.getNextFlowNodeFor(flowNode);

    await this.flowNodeInstanceService.persistOnExit(executionContextFacade, token, flowNode.id, this.flowNodeInstanceId);

    return new NextFlowNodeInfo(nextFlowNodeInfo, token, processTokenFacade);
  }

  private async _waitForMessage(processInstanceId: string, messageReference: string): Promise<void> {

    return new Promise<void>((resolve: Function): void => {

      const messageName: string = `/processengine/process/${processInstanceId}/message/${messageReference}`;

      const subscription: ISubscription = this.eventAggregator.subscribeOnce(messageName, async(message: any) => {

        if (subscription) {
          subscription.dispose();
        }

        resolve();
      });
    });
  }
}
