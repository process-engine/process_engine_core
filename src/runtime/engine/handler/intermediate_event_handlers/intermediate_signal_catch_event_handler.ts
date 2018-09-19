import {
  IExecutionContextFacade,
  IFlowNodeInstanceService,
  IProcessModelFacade,
  IProcessTokenFacade,
  Model,
  NextFlowNodeInfo,
  Runtime,
  SignalEventReachedMessage,
} from '@process-engine/process_engine_contracts';

import {IEventAggregator, ISubscription} from '@essential-projects/event_aggregator_contracts';

import {FlowNodeHandler} from '../index';

export class IntermediateSignalCatchEventHandler extends FlowNodeHandler<Model.Events.IntermediateCatchEvent> {

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

    await this.flowNodeInstanceService.persistOnEnter(flowNode.id, this.flowNodeInstanceId, token);
    await this.flowNodeInstanceService.suspend(flowNode.id, this.flowNodeInstanceId, token);

    const receivedSignal: SignalEventReachedMessage = await this._waitForSignal(flowNode.signalEventDefinition.signalRef);

    processTokenFacade.addResultForFlowNode(flowNode.id, receivedSignal.tokenPayload);
    token.payload = receivedSignal.tokenPayload;

    await this.flowNodeInstanceService.resume(flowNode.id, this.flowNodeInstanceId, token);

    const nextFlowNodeInfo: Model.Base.FlowNode = processModelFacade.getNextFlowNodeFor(flowNode);

    await this.flowNodeInstanceService.persistOnExit(flowNode.id, this.flowNodeInstanceId, token);

    return new NextFlowNodeInfo(nextFlowNodeInfo, token, processTokenFacade);
  }

  private async _waitForSignal(signalReference: string): Promise<SignalEventReachedMessage> {

    return new Promise<SignalEventReachedMessage>((resolve: Function): void => {

      const signalName: string = `/processengine/process/signal/${signalReference}`;

      const subscription: ISubscription = this.eventAggregator.subscribeOnce(signalName, async(signal: SignalEventReachedMessage) => {

        if (subscription) {
          subscription.dispose();
        }

        return resolve(signal);
      });
    });
  }
}
