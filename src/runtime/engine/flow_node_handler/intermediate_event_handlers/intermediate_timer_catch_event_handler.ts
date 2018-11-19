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

import {Logger} from 'loggerhythm';
import {FlowNodeHandler} from '../index';

const logger: Logger = Logger.createLogger('processengine:runtime:intermediate_timer_catch_event');

export class IntermediateTimerCatchEventHandler extends FlowNodeHandler<Model.Events.IntermediateCatchEvent> {

  private _timerFacade: ITimerFacade;

  constructor(flowNodeInstanceService: IFlowNodeInstanceService,
              loggingService: ILoggingApi,
              metricsService: IMetricsApi,
              timerFacade: ITimerFacade,
              timerCatchEventModel: Model.Events.IntermediateCatchEvent) {
    super(flowNodeInstanceService, loggingService, metricsService, timerCatchEventModel);
    this._timerFacade = timerFacade;
  }

  private get timerCatchEvent(): Model.Events.IntermediateCatchEvent {
    return super.flowNode;
  }

  protected async executeInternally(token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    identity: IIdentity): Promise<NextFlowNodeInfo> {

    await this.persistOnEnter(token);

    return new Promise<NextFlowNodeInfo>(async(resolve: Function, reject: Function): Promise<void> => {

      let timerSubscription: ISubscription;

      const timerType: TimerDefinitionType = this._timerFacade.parseTimerDefinitionType(this.timerCatchEvent.timerEventDefinition);
      const timerValueFromDefinition: string = this._timerFacade.parseTimerDefinitionValue(this.timerCatchEvent.timerEventDefinition);
      const timerValue: string = await this._executeTimerExpressionIfNeeded(timerValueFromDefinition, processTokenFacade);

      const nextFlowNodeInfo: Model.Base.FlowNode = processModelFacade.getNextFlowNodeFor(this.timerCatchEvent);

      const timerElapsed: any = async(): Promise<void> => {

        await this.persistOnResume(token);

        const oldTokenFormat: any = await processTokenFacade.getOldTokenFormat();
        await processTokenFacade.addResultForFlowNode(this.timerCatchEvent.id, oldTokenFormat.current);

        if (timerSubscription && timerType !== TimerDefinitionType.cycle) {
          timerSubscription.dispose();
        }

        await this.persistOnExit(token);

        resolve(new NextFlowNodeInfo(nextFlowNodeInfo, token, processTokenFacade));
      };

      await this.persistOnSuspend(token);
      timerSubscription = this._timerFacade.initializeTimer(this.timerCatchEvent, timerType, timerValue, timerElapsed);
    });
  }

  public async resumeInternally(flowNodeInstance: Runtime.Types.FlowNodeInstance,
                                processTokenFacade: IProcessTokenFacade,
                                processModelFacade: IProcessModelFacade,
                                identity: IIdentity,
                              ): Promise<NextFlowNodeInfo> {

    throw new Error('Not implemented yet.');
  }

  private async _executeTimerExpressionIfNeeded(timerExpression: string, processTokenFacade: IProcessTokenFacade): Promise<string> {
    const tokenVariableName: string = 'token';
    const isConstantTimerExpression: boolean = !timerExpression.includes(tokenVariableName);

    if (isConstantTimerExpression) {
      return timerExpression;
    }

    const tokenData: any = await processTokenFacade.getOldTokenFormat();

    try {
      const functionString: string = `return ${timerExpression}`;
      const evaluateFunction: Function = new Function(tokenVariableName, functionString);

      return evaluateFunction.call(tokenData, tokenData);

    } catch (err) {
      logger.error(err);

      throw err;
    }
  }
}
