import {Logger} from 'loggerhythm';

import {Subscription} from '@essential-projects/event_aggregator_contracts';
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

import {BadRequestError} from '@essential-projects/errors_ts';
import * as moment from 'moment';
import {FlowNodeHandlerInterruptible} from '../index';

export class IntermediateTimerCatchEventHandler extends FlowNodeHandlerInterruptible<Model.Events.IntermediateCatchEvent> {

  private _timerFacade: ITimerFacade;
  private timerSubscription: Subscription;

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

    /**
     * It makes sense to check the definitions before we actually
     * initalizing the timer.
     *
     * todo: We only need to parse the timer type and timer value ones.
     */
    const timerType: TimerDefinitionType = this._timerFacade.parseTimerDefinitionType(this.timerCatchEvent.timerEventDefinition);
    const timerValueFromDefinition: string = this._timerFacade.parseTimerDefinitionValue(this.timerCatchEvent.timerEventDefinition);

    this._validateTimerValue(timerType, timerValueFromDefinition);

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

    const handlerPromise: Promise<NextFlowNodeInfo> = new Promise<NextFlowNodeInfo>(async(resolve: Function, reject: Function): Promise<void> => {

      const timerPromise: Promise<void> = this._executeTimer(token, processTokenFacade, processModelFacade);

      this.onInterruptedCallback = (interruptionToken: Runtime.Types.ProcessToken): void => {

        processTokenFacade.addResultForFlowNode(this.timerCatchEvent.id, interruptionToken);

        if (this.timerSubscription) {
          this._timerFacade.cancelTimerSubscription(this.timerSubscription);
        }

        timerPromise.cancel();
        handlerPromise.cancel();

        return;
      };

      await timerPromise;

      processTokenFacade.addResultForFlowNode(this.timerCatchEvent.id, token.payload);

      await this.persistOnResume(token);
      await this.persistOnExit(token);

      const nextFlowNodeInfo: NextFlowNodeInfo = this.getNextFlowNodeInfo(token, processTokenFacade, processModelFacade);

      return resolve(nextFlowNodeInfo);
    });

    return handlerPromise;
  }

  private _executeTimer(token: Runtime.Types.ProcessToken,
                        processTokenFacade: IProcessTokenFacade,
                        processModelFacade: IProcessModelFacade): Promise<void> {

    return new Promise<void>(async(resolve: Function, reject: Function): Promise<void> => {
      const timerType: TimerDefinitionType = this._timerFacade.parseTimerDefinitionType(this.timerCatchEvent.timerEventDefinition);
      const timerValueFromDefinition: string = this._timerFacade.parseTimerDefinitionValue(this.timerCatchEvent.timerEventDefinition);
      const timerValue: string = this._executeTimerExpressionIfNeeded(timerValueFromDefinition, processTokenFacade);

      const timerElapsed: any = (): void => {
        // TODO: Can't handle cyclic timers yet, so we always need to clean this up for now.
        this._timerFacade.cancelTimerSubscription(this.timerSubscription);
        resolve();
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

  private _validateTimerValue(timerType: TimerDefinitionType, timerValue: string): void {
    switch (timerType) {
      case TimerDefinitionType.date: {
        const iso8601DateIsInvalid: boolean = !moment(timerValue, moment.ISO_8601).isValid();
        if (iso8601DateIsInvalid) {
          throw new BadRequestError(`The given date definition ${timerValue} is not in ISO8601 format`);
        }

        break;
      }

      case TimerDefinitionType.duration: {
        /**
         * Note: Because of this Issue: https://github.com/moment/moment/issues/1805
         * we can't really use momentjs to validate the given timer value, if
         * its in the ISO8601 duration format.
         *
         * There is an isValid() method on moment.Duration objects but its
         * useless since it always returns true.
         */

          /**
          * Stolen from: https://stackoverflow.com/a/32045167
          */
        /*tslint:disable:max-line-length*/
        const durationRegex: RegExp = /^P(?!$)(\d+(?:\.\d+)?Y)?(\d+(?:\.\d+)?M)?(\d+(?:\.\d+)?W)?(\d+(?:\.\d+)?D)?(T(?=\d)(\d+(?:\.\d+)?H)?(\d+(?:\.\d+)?M)?(\d+(?:\.\d+)?S)?)?$/gm;
        const iso8601DurationIsInvalid: boolean = !durationRegex.test(timerValue);

        if (iso8601DurationIsInvalid) {
          throw new BadRequestError(`The given duration defintion ${timerValue} is not in ISO8601 format`);
        }

        break;
      }

      case TimerDefinitionType.cycle: {
        /**
         * This issue currently blocks the validation for Cyclic timers:
         * https://github.com/process-engine/process_engine_runtime/issues/196
         */
        break;
      }

      default: {
        throw new BadRequestError('Unknown Timer definition type');
      }

    }
  }
}
