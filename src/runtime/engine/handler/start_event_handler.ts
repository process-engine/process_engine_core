import {IEventAggregator, ISubscription} from '@essential-projects/event_aggregator_contracts';

import {
  IExecutionContextFacade,
  IFlowNodeInstanceService,
  IProcessModelFacade,
  IProcessTokenFacade,
  ITimerFacade,
  Model,
  NextFlowNodeInfo,
  Runtime,
  TimerDefinitionType,
} from '@process-engine/process_engine_contracts';

import {FlowNodeHandler} from './index';

export class StartEventHandler extends FlowNodeHandler<Model.Events.StartEvent> {

  private _eventAggregator: IEventAggregator;
  private _flowNodeInstanceService: IFlowNodeInstanceService = undefined;
  private _timerFacade: ITimerFacade;

  constructor(eventAggregator: IEventAggregator, flowNodeInstanceService: IFlowNodeInstanceService, timerFacade: ITimerFacade) {
    super();
    this._eventAggregator = eventAggregator;
    this._flowNodeInstanceService = flowNodeInstanceService;
    this._timerFacade = timerFacade;
  }

  private get eventAggregator(): IEventAggregator {
    return this._eventAggregator;
  }

  private get flowNodeInstanceService(): IFlowNodeInstanceService {
    return this._flowNodeInstanceService;
  }

  private get timerFacade(): ITimerFacade {
    return this._timerFacade;
  }

  protected async executeInternally(flowNode: Model.Events.StartEvent,
                                    token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    executionContextFacade: IExecutionContextFacade): Promise<NextFlowNodeInfo> {

    await this.flowNodeInstanceService.persistOnEnter(flowNode.id, this.flowNodeInstanceId, token);

    const isMessageStartEvent: boolean = flowNode.messageEventDefinition !== undefined;
    const isSignalStartEvent: boolean = flowNode.signalEventDefinition !== undefined;
    const isTimerStartEvent: boolean = flowNode.timerEventDefinition !== undefined;

    // If the StartEvent is not a regular StartEvent,
    // wait for the defined condition to be fulfilled.
    if (isMessageStartEvent) {
      await this._waitForMessage(flowNode, token, flowNode.messageEventDefinition.messageRef);
    } else if (isSignalStartEvent) {
      await this._waitForSignal(flowNode, token, flowNode.signalEventDefinition.signalRef);
    } else if (isTimerStartEvent) {
      await this._waitForTimerToElapse(flowNode, token);
    }

    const nextFlowNode: Model.Base.FlowNode = await processModelFacade.getNextFlowNodeFor(flowNode);

    await this.flowNodeInstanceService.persistOnExit(flowNode.id, this.flowNodeInstanceId, token);

    return new NextFlowNodeInfo(nextFlowNode, token, processTokenFacade);
  }

  /**
   * Creates a subscription on the EventAggregator and waits to receive the
   * designated message.
   *
   * @async
   * @param flowNode    The FlowNode containing the StartEvent.
   * @param token       The current ProcessToken.
   * @param messageName The message to wait for.
   */
  private async _waitForMessage(flowNode: Model.Events.StartEvent,
                                token: Runtime.Types.ProcessToken,
                                messageName: string): Promise<void> {

    await this.flowNodeInstanceService.suspend(flowNode.id, this.flowNodeInstanceId, token);

    return new Promise<void>((resolve: Function): void => {

      const event: string = `/processengine/process/message/${messageName}`;

      const subscription: ISubscription = this.eventAggregator.subscribeOnce(event, async(message: any) => {

        if (subscription) {
          subscription.dispose();
        }

        await this.flowNodeInstanceService.resume(flowNode.id, this.flowNodeInstanceId, token);

        resolve();
      });
    });
  }

  /**
   * Creates a subscription on the EventAggregator and waits to receive the
   * designated signal.
   *
   * @async
   * @param flowNode   The FlowNode containing the StartEvent.
   * @param token      The current ProcessToken.
   * @param signalName The signal to wait for.
   */
  private async _waitForSignal(flowNode: Model.Events.StartEvent,
                               token: Runtime.Types.ProcessToken,
                               signalName: string): Promise<void> {

    await this.flowNodeInstanceService.suspend(flowNode.id, this.flowNodeInstanceId, token);

    return new Promise<void>((resolve: Function): void => {

      const event: string = `/processengine/process/signal/${signalName}`;

      const subscription: ISubscription = this.eventAggregator.subscribeOnce(event, async(message: any) => {

        if (subscription) {
          subscription.dispose();
        }

        await this.flowNodeInstanceService.resume(flowNode.id, this.flowNodeInstanceId, token);

        resolve();
      });
    });
  }

  /**
   * If a timed StartEvent is used, this will delay the events execution
   * until the timer has elapsed.
   *
   * @async
   * @param flowNode The FlowNode containing the StartEvent.
   * @param token    The current ProcessToken.
   */
  private async _waitForTimerToElapse(flowNode: Model.Events.StartEvent, token: Runtime.Types.ProcessToken): Promise<void> {

    await this.flowNodeInstanceService.suspend(flowNode.id, this.flowNodeInstanceId, token);

    return new Promise<void> (async(resolve: Function, reject: Function): Promise<void> => {

      let timerSubscription: ISubscription;

      const timerType: TimerDefinitionType = this.timerFacade.parseTimerDefinitionType(flowNode.timerEventDefinition);
      const timerValue: string = this.timerFacade.parseTimerDefinitionValue(flowNode.timerEventDefinition);

      const timerElapsed: any = async(): Promise<void> => {

        await this.flowNodeInstanceService.resume(flowNode.id, this.flowNodeInstanceId, token);

        if (timerSubscription && timerType !== TimerDefinitionType.cycle) {
          timerSubscription.dispose();
        }

        resolve();
      };

      timerSubscription = await this.timerFacade.initializeTimer(flowNode, timerType, timerValue, timerElapsed);
    });
  }
}
