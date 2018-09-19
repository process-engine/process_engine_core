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

import {ISubscription} from '@essential-projects/event_aggregator_contracts';

import {FlowNodeHandler} from '../index';

export class IntermediateTimerCatchEventHandler extends FlowNodeHandler<Model.Events.IntermediateCatchEvent> {

  private _flowNodeInstanceService: IFlowNodeInstanceService = undefined;
  private _timerFacade: ITimerFacade;

  constructor(flowNodeInstanceService: IFlowNodeInstanceService, timerFacade: ITimerFacade) {
    super();
    this._flowNodeInstanceService = flowNodeInstanceService;
    this._timerFacade = timerFacade;
  }

  private get flowNodeInstanceService(): IFlowNodeInstanceService {
    return this._flowNodeInstanceService;
  }

  private get timerFacade(): ITimerFacade {
    return this._timerFacade;
  }

  protected async executeInternally(flowNode: Model.Events.IntermediateCatchEvent,
                                    token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    executionContextFacade: IExecutionContextFacade): Promise<NextFlowNodeInfo> {

    await this.flowNodeInstanceService.persistOnEnter(flowNode.id, this.flowNodeInstanceId, token);
    await this.flowNodeInstanceService.suspend(flowNode.id, this.flowNodeInstanceId, token);

    return new Promise<NextFlowNodeInfo> (async(resolve: Function, reject: Function): Promise<void> => {

      let timerSubscription: ISubscription;

      const timerType: TimerDefinitionType = this.timerFacade.parseTimerDefinitionType(flowNode.timerEventDefinition);
      const timerValue: string = this.timerFacade.parseTimerDefinitionValue(flowNode.timerEventDefinition);

      const nextFlowNodeInfo: Model.Base.FlowNode = processModelFacade.getNextFlowNodeFor(flowNode);

      const timerElapsed: any = async(): Promise<void> => {

        const oldTokenFormat: any = await processTokenFacade.getOldTokenFormat();
        await processTokenFacade.addResultForFlowNode(flowNode.id, oldTokenFormat.current);

        await this.flowNodeInstanceService.resume(flowNode.id, this.flowNodeInstanceId, token);
        await this.flowNodeInstanceService.persistOnExit(flowNode.id, this.flowNodeInstanceId, token);

        if (timerSubscription && timerType !== TimerDefinitionType.cycle) {
          timerSubscription.dispose();
        }

        resolve(new NextFlowNodeInfo(nextFlowNodeInfo, token, processTokenFacade));
      };

      timerSubscription = await this.timerFacade.initializeTimer(flowNode, timerType, timerValue, timerElapsed);
    });
  }
}
