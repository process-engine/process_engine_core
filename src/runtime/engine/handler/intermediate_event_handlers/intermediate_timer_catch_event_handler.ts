import {ISubscription} from '@essential-projects/event_aggregator_contracts';

import {IMetricsApi} from '@process-engine/metrics_api_contracts';
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

import {FlowNodeHandler} from '../index';

export class IntermediateTimerCatchEventHandler extends FlowNodeHandler<Model.Events.IntermediateCatchEvent> {

  private _timerFacade: ITimerFacade;

  constructor(flowNodeInstanceService: IFlowNodeInstanceService, metricsService: IMetricsApi, timerFacade: ITimerFacade) {
    super(flowNodeInstanceService, metricsService);
    this._timerFacade = timerFacade;
  }

  private get timerFacade(): ITimerFacade {
    return this._timerFacade;
  }

  protected async executeInternally(timerCatchEvent: Model.Events.IntermediateCatchEvent,
                                    token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    executionContextFacade: IExecutionContextFacade): Promise<NextFlowNodeInfo> {

    await this.persistOnEnter(timerCatchEvent, token);

    return new Promise<NextFlowNodeInfo> (async(resolve: Function, reject: Function): Promise<void> => {

      let timerSubscription: ISubscription;

      const timerType: TimerDefinitionType = this.timerFacade.parseTimerDefinitionType(timerCatchEvent.timerEventDefinition);
      const timerValue: string = this.timerFacade.parseTimerDefinitionValue(timerCatchEvent.timerEventDefinition);

      const nextFlowNodeInfo: Model.Base.FlowNode = processModelFacade.getNextFlowNodeFor(timerCatchEvent);

      const timerElapsed: any = async(): Promise<void> => {

        await this.persistOnResume(timerCatchEvent, token);

        const oldTokenFormat: any = await processTokenFacade.getOldTokenFormat();
        await processTokenFacade.addResultForFlowNode(timerCatchEvent.id, oldTokenFormat.current);

        if (timerSubscription && timerType !== TimerDefinitionType.cycle) {
          timerSubscription.dispose();
        }

        await this.persistOnExit(timerCatchEvent, token);

        resolve(new NextFlowNodeInfo(nextFlowNodeInfo, token, processTokenFacade));
      };

      await this.persistOnSuspend(timerCatchEvent, token);
      timerSubscription = await this.timerFacade.initializeTimer(timerCatchEvent, timerType, timerValue, timerElapsed);
    });
  }
}
