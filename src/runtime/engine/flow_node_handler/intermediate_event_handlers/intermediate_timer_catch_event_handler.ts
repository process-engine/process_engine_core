import {Logger} from 'loggerhythm';

import {InternalServerError} from '@essential-projects/errors_ts';
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

  protected async resumeInternally(flowNodeInstance: Runtime.Types.FlowNodeInstance,
                                   processTokenFacade: IProcessTokenFacade,
                                   processModelFacade: IProcessModelFacade,
                                   identity: IIdentity,
                                 ): Promise<NextFlowNodeInfo> {

    this.logger.verbose(`Resuming TimerCatchEvent instance ${flowNodeInstance.id}`);

    switch (flowNodeInstance.state) {
      case Runtime.Types.FlowNodeInstanceState.suspended:
        this.logger.verbose(`TimerCatchEvent ${flowNodeInstance.id} was left suspended. Restarting the timer.`);
        const suspendToken: Runtime.Types.ProcessToken = flowNodeInstance.getTokenByType(Runtime.Types.ProcessTokenType.onSuspend);

        return this._continueAfterSuspend(flowNodeInstance, suspendToken, processTokenFacade, processModelFacade);

      case Runtime.Types.FlowNodeInstanceState.running:
        const resumeToken: Runtime.Types.ProcessToken = flowNodeInstance.getTokenByType(Runtime.Types.ProcessTokenType.onResume);

        const messageNotYetReceived: boolean = resumeToken === undefined;
        if (messageNotYetReceived) {
          this.logger.verbose(`TimerCatchEvent ${flowNodeInstance.id} was interrupted at the beginning. Resuming from the start.`);
          const onEnterToken: Runtime.Types.ProcessToken = flowNodeInstance.getTokenByType(Runtime.Types.ProcessTokenType.onEnter);

          return this._continueAfterEnter(onEnterToken, processTokenFacade, processModelFacade);
        }

        this.logger.verbose(`TimerCatchEvent ${flowNodeInstance.id} already received its message. Finishing up the handler.`);

        return this._continueAfterResume(resumeToken, processTokenFacade, processModelFacade);

      case Runtime.Types.FlowNodeInstanceState.finished:
        this.logger.verbose(`TimerCatchEvent ${flowNodeInstance.id} was already finished. Skipping ahead.`);
        const onExitToken: Runtime.Types.ProcessToken = flowNodeInstance.getTokenByType(Runtime.Types.ProcessTokenType.onExit);

        return this._continueAfterExit(onExitToken, processTokenFacade, processModelFacade);

      case Runtime.Types.FlowNodeInstanceState.error:
        this.logger.error(`Cannot resume TimerCatchEvent instance ${flowNodeInstance.id}, because it previously exited with an error!`,
                     flowNodeInstance.error);
        throw flowNodeInstance.error;

      case Runtime.Types.FlowNodeInstanceState.terminated:
        const terminatedError: string = `Cannot resume TimerCatchEvent instance ${flowNodeInstance.id}, because it was terminated!`;
        this.logger.error(terminatedError);
        throw new InternalServerError(terminatedError);

      default:
        const invalidStateError: string = `Cannot resume TimerCatchEvent instance ${flowNodeInstance.id}, because its state cannot be determined!`;
        this.logger.error(invalidStateError);
        throw new InternalServerError(invalidStateError);
    }
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

    return new Promise<NextFlowNodeInfo>(async(resolve: Function, reject: Function): Promise<void> => {

      let timerSubscription: ISubscription;

      const timerType: TimerDefinitionType = this._timerFacade.parseTimerDefinitionType(this.timerCatchEvent.timerEventDefinition);
      const timerValueFromDefinition: string = this._timerFacade.parseTimerDefinitionValue(this.timerCatchEvent.timerEventDefinition);
      const timerValue: string = await this._executeTimerExpressionIfNeeded(timerValueFromDefinition, processTokenFacade);

      const nextFlowNodeInfo: Model.Base.FlowNode = processModelFacade.getNextFlowNodeFor(this.timerCatchEvent);

      const timerElapsed: any = async(): Promise<void> => {

        await this.persistOnResume(token);

        await processTokenFacade.addResultForFlowNode(this.timerCatchEvent.id, token.payload);

        if (timerSubscription && timerType !== TimerDefinitionType.cycle) {
          timerSubscription.dispose();
        }

        await this.persistOnExit(token);

        resolve(new NextFlowNodeInfo(nextFlowNodeInfo, token, processTokenFacade));
      };

      timerSubscription = this._timerFacade.initializeTimer(this.timerCatchEvent, timerType, timerValue, timerElapsed);
    });
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
