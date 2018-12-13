import * as Bluebird from 'bluebird';
import {Logger} from 'loggerhythm';

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

import {FlowNodeHandlerInterruptable} from '../index';

export class IntermediateTimerCatchEventHandler extends FlowNodeHandlerInterruptable<Model.Events.IntermediateCatchEvent> {

  private _timerFacade: ITimerFacade;
  private timerSubscription: ISubscription;

  constructor(flowNodeInstanceService: IFlowNodeInstanceService,
              loggingService: ILoggingApi,
              metricsService: IMetricsApi,
              timerFacade: ITimerFacade,
              timerCatchEventModel: Model.Events.IntermediateCatchEvent) {
    super(flowNodeInstanceService, loggingService, metricsService, timerCatchEventModel);
    this._timerFacade = timerFacade;
    this.logger = Logger.createLogger(`processengine:timer_catch_event_handler:${timerCatchEventModel.id}`);
  }

  private get timerCatchEvent(): Model.Events.IntermediateCatchEvent {
    return super.flowNode;
  }

  protected async executeInternally(token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    identity: IIdentity): Promise<NextFlowNodeInfo> {

    this.logger.verbose(`Executing TimerCatchEvent instance ${this.flowNodeInstanceId}.`);
    await this.persistOnEnter(token);
    await this.persistOnSuspend(token);

    return await this._executeHandler(token, processTokenFacade, processModelFacade);
  }

  protected async _continueAfterEnter(onEnterToken: Runtime.Types.ProcessToken,
                                      processTokenFacade: IProcessTokenFacade,
                                      processModelFacade: IProcessModelFacade,
                                     ): Promise<NextFlowNodeInfo> {

    await this.persistOnSuspend(onEnterToken);

    return this._executeHandler(onEnterToken, processTokenFacade, processModelFacade);
  }

  protected async _continueAfterSuspend(flowNodeInstance: Runtime.Types.FlowNodeInstance,
                                        onSuspendToken: Runtime.Types.ProcessToken,
                                        processTokenFacade: IProcessTokenFacade,
                                        processModelFacade: IProcessModelFacade,
                                      ): Promise<NextFlowNodeInfo> {

    return this._executeHandler(onSuspendToken, processTokenFacade, processModelFacade);
  }

  protected async _executeHandler(token: Runtime.Types.ProcessToken,
                                  processTokenFacade: IProcessTokenFacade,
                                  processModelFacade: IProcessModelFacade): Promise<NextFlowNodeInfo> {

    const handlerPromise: Bluebird<NextFlowNodeInfo> = new Bluebird<NextFlowNodeInfo>(async(resolve: Function, reject: Function): Promise<void> => {

      const timerPromise: Bluebird<void> = this._executeTimer(token, processTokenFacade, processModelFacade);

      this.onInterruptedCallback = (interruptionToken: Runtime.Types.ProcessToken): void => {

        processTokenFacade.addResultForFlowNode(this.timerCatchEvent.id, interruptionToken);

        if (this.timerSubscription) {
          this.timerSubscription.dispose();
        }

        timerPromise.cancel();
        handlerPromise.cancel();

        return;
      };

      await timerPromise;

      if (this.timerSubscription) {
        this.timerSubscription.dispose();
      }

      const nextFlowNodeInfo: NextFlowNodeInfo = this.getNextFlowNodeInfo(token, processTokenFacade, processModelFacade);

      return resolve(nextFlowNodeInfo);
    });

    return handlerPromise;
  }

  private _executeTimer(token: Runtime.Types.ProcessToken,
                        processTokenFacade: IProcessTokenFacade,
                        processModelFacade: IProcessModelFacade): Bluebird<void> {

    return new Bluebird<void>(async(resolve: Function, reject: Function): Promise<void> => {

      const timerType: TimerDefinitionType = this._timerFacade.parseTimerDefinitionType(this.timerCatchEvent.timerEventDefinition);
      const timerValueFromDefinition: string = this._timerFacade.parseTimerDefinitionValue(this.timerCatchEvent.timerEventDefinition);
      const timerValue: string = this._executeTimerExpressionIfNeeded(timerValueFromDefinition, processTokenFacade);

      const timerElapsed: any = (): void => {

        if (this.timerSubscription && timerType !== TimerDefinitionType.cycle) {
          this.timerSubscription.dispose();
        }

        // if the timer elapsed before the decorated handler finished execution,
        // the TimerBoundaryEvent will be used to determine the next FlowNode to execute
        processTokenFacade.addResultForFlowNode(this.timerCatchEvent.id, token.payload);

        const nextNodeAfterBoundaryEvent: Model.Base.FlowNode = processModelFacade.getNextFlowNodeFor(this.timerCatchEvent);
        resolve(new NextFlowNodeInfo(nextNodeAfterBoundaryEvent, token, processTokenFacade));
      };

      this.timerSubscription = this._timerFacade.initializeTimer(this.timerCatchEvent, timerType, timerValue, timerElapsed);
    });
  }

  private _executeTimerExpressionIfNeeded(timerExpression: string, processTokenFacade: IProcessTokenFacade): string {
    const tokenVariableName: string = 'token';
    const isConstantTimerExpression: boolean = !timerExpression.includes(tokenVariableName);

    if (isConstantTimerExpression) {
      return timerExpression;
    }

    const tokenData: any = processTokenFacade.getOldTokenFormat();

    try {
      const functionString: string = `return ${timerExpression}`;
      const evaluateFunction: Function = new Function(tokenVariableName, functionString);

      return evaluateFunction.call(tokenData, tokenData);

    } catch (err) {
      this.logger.error(err);

      throw err;
    }
  }
}
