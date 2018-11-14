import {ISubscription} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';

import {ILoggingApi} from '@process-engine/logging_api_contracts';
import {IMetricsApi} from '@process-engine/metrics_api_contracts';
import {
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

export class TimerBoundaryEventHandler extends FlowNodeHandler<Model.Events.BoundaryEvent> {

  private _decoratedHandler: FlowNodeHandler<Model.Base.FlowNode>;
  private _timerFacade: ITimerFacade;

constructor(flowNodeInstanceService: IFlowNodeInstanceService,
            loggingApiService: ILoggingApi,
            metricsService: IMetricsApi,
            timerFacade: ITimerFacade,
            decoratedHandler: FlowNodeHandler<Model.Base.FlowNode>,
            timerBoundaryEventModel: Model.Events.BoundaryEvent) {
    super(flowNodeInstanceService, loggingApiService, metricsService, timerBoundaryEventModel);
    this._decoratedHandler = decoratedHandler;
    this._timerFacade = timerFacade;
  }

  private get timerBoundaryEvent(): Model.Events.BoundaryEvent {
    return super.flowNode;
  }

  private get decoratedHandler(): FlowNodeHandler<Model.Base.FlowNode> {
    return this._decoratedHandler;
  }

  private get timerFacade(): ITimerFacade {
    return this._timerFacade;
  }

  protected async executeInternally(token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    identity: IIdentity): Promise<NextFlowNodeInfo> {

    return new Promise<NextFlowNodeInfo> (async(resolve: Function, reject: Function): Promise<NextFlowNodeInfo> => {

      let timerSubscription: ISubscription;

      const timerType: TimerDefinitionType = this.timerFacade.parseTimerDefinitionType(this.timerBoundaryEvent.timerEventDefinition);
      const timerValue: string = this.timerFacade.parseTimerDefinitionValue(this.timerBoundaryEvent.timerEventDefinition);

      try {

        let timerHasElapsed: boolean = false;
        let hasHandlerFinished: boolean = false;

        const timerElapsed: any = async(): Promise<void> => {
          if (hasHandlerFinished) {
            return;
          }
          timerHasElapsed = true;

          // if the timer elapsed before the decorated handler finished execution,
          // the TimerBoundaryEvent will be used to determine the next FlowNode to execute

          const oldTokenFormat: any = await processTokenFacade.getOldTokenFormat();
          await processTokenFacade.addResultForFlowNode(this.timerBoundaryEvent.id, oldTokenFormat.current);

          const nextNodeAfterBoundaryEvent: Model.Base.FlowNode = processModelFacade.getNextFlowNodeFor(this.timerBoundaryEvent);
          resolve(new NextFlowNodeInfo(nextNodeAfterBoundaryEvent, token, processTokenFacade));
        };

        timerSubscription = await this.timerFacade.initializeTimer(this.timerBoundaryEvent, timerType, timerValue, timerElapsed);

        const nextFlowNodeInfo: NextFlowNodeInfo = await this.decoratedHandler.execute(token,
                                                                                       processTokenFacade,
                                                                                       processModelFacade,
                                                                                       identity);

        if (timerHasElapsed) {
          return;
        }

        // if the decorated handler finished execution before the timer elapsed,
        // continue the regular execution with the next FlowNode and dispose the timer

        hasHandlerFinished = true;
        resolve(nextFlowNodeInfo);

      } finally {
        if (timerSubscription && timerType !== TimerDefinitionType.cycle) {
          timerSubscription.dispose();
        }
      }
    });
  }
}
