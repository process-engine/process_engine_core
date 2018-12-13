import * as Bluebird from 'bluebird';

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
import {FlowNodeHandlerInterruptible} from '../index';

export class TimerBoundaryEventHandler extends FlowNodeHandlerInterruptible<Model.Events.BoundaryEvent> {

  private _decoratedHandler: FlowNodeHandlerInterruptible<Model.Base.FlowNode>;
  private _timerFacade: ITimerFacade;

  private timerHasElapsed: boolean = false;
  private hasHandlerFinished: boolean = false;

  private handlerPromise: Bluebird<NextFlowNodeInfo>;
  private timerSubscription: ISubscription;

  constructor(flowNodeInstanceService: IFlowNodeInstanceService,
              loggingApiService: ILoggingApi,
              metricsService: IMetricsApi,
              timerFacade: ITimerFacade,
              decoratedHandler: FlowNodeHandlerInterruptible<Model.Base.FlowNode>,
              timerBoundaryEventModel: Model.Events.BoundaryEvent) {
    super(flowNodeInstanceService, loggingApiService, metricsService, timerBoundaryEventModel);
    this._decoratedHandler = decoratedHandler;
    this._timerFacade = timerFacade;
    this.logger = Logger.createLogger(`processengine:runtime:timer_boundary_event:${timerBoundaryEventModel.id}`);
  }

  private get timerBoundaryEvent(): Model.Events.BoundaryEvent {
    return super.flowNode;
  }

  public async interrupt(token: Runtime.Types.ProcessToken, terminate?: boolean): Promise<void> {

    if (this.timerSubscription) {
      this.timerSubscription.dispose();
    }
    this.handlerPromise.cancel();

    // TODO: This check can probably be removed as soon as CallActivities and SubprocessHandlers can be interrupted.
    // But that will not happen until we are able to interrupt Subprocesses.
    const handlerIsInterruptible: boolean = typeof (this._decoratedHandler as any).interrupt === 'function';
    if (handlerIsInterruptible) {
      this._decoratedHandler.interrupt(token, terminate);
    }
  }

  protected async executeInternally(token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    identity: IIdentity): Promise<NextFlowNodeInfo> {

    this.handlerPromise = new Bluebird<NextFlowNodeInfo>(async(resolve: Function, reject: Function): Promise<NextFlowNodeInfo> => {

      this._executeTimer(resolve, token, processTokenFacade, processModelFacade);

      const nextFlowNodeInfo: NextFlowNodeInfo =
        await this._decoratedHandler.execute(token, processTokenFacade, processModelFacade, identity, this.previousFlowNodeInstanceId);

      this.hasHandlerFinished = true;

      if (this.timerSubscription) {
        this.timerSubscription.dispose();
      }

      if (this.timerHasElapsed) {
        return;
      }

      // if the decorated handler finished execution before the timer elapsed,
      // continue the regular execution with the next FlowNode and dispose the timer
      return resolve(nextFlowNodeInfo);
    });

    return this.handlerPromise;
  }

  protected async resumeInternally(flowNodeInstance: Runtime.Types.FlowNodeInstance,
                                   processTokenFacade: IProcessTokenFacade,
                                   processModelFacade: IProcessModelFacade,
                                   identity: IIdentity,
                                  ): Promise<NextFlowNodeInfo> {

    this.handlerPromise = new Bluebird<NextFlowNodeInfo> (async(resolve: Function, reject: Function): Promise<NextFlowNodeInfo> => {

      const onEnterToken: Runtime.Types.ProcessToken = flowNodeInstance.getTokenByType(Runtime.Types.ProcessTokenType.onEnter);
      this._executeTimer(resolve, onEnterToken, processTokenFacade, processModelFacade);

      const nextFlowNodeInfo: NextFlowNodeInfo =
        await this._decoratedHandler.resume(flowNodeInstance, processTokenFacade, processModelFacade, identity);

      if (this.timerSubscription) {
        this.timerSubscription.dispose();
      }

      if (this.timerHasElapsed) {
        return;
      }

      // if the decorated handler finished resumption before the timer elapsed,
      // continue the regular execution with the next FlowNode and dispose the timer
      this.hasHandlerFinished = true;

      return resolve(nextFlowNodeInfo);
    });

    return this.handlerPromise;
  }

  private async _executeTimer(resolveFunc: Function,
                              token: Runtime.Types.ProcessToken,
                              processTokenFacade: IProcessTokenFacade,
                              processModelFacade: IProcessModelFacade): Promise<void> {

    const timerType: TimerDefinitionType = this._timerFacade.parseTimerDefinitionType(this.timerBoundaryEvent.timerEventDefinition);
    const timerValueFromDefinition: string = this._timerFacade.parseTimerDefinitionValue(this.timerBoundaryEvent.timerEventDefinition);
    const timerValue: string = this._executeTimerExpressionIfNeeded(timerValueFromDefinition, processTokenFacade);

    const timerElapsed: any = (): void => {

      // No matter what timer type is used, a TimerBoundaryEvent can only ever run once,
      // given that the decorated handler itself can only run once.
      if (this.timerSubscription) {
        this.timerSubscription.dispose();
      }

      if (this.hasHandlerFinished) {
        return;
      }
      this.timerHasElapsed = true;
      this._decoratedHandler.interrupt(token);

      // if the timer elapsed before the decorated handler finished execution,
      // the TimerBoundaryEvent will be used to determine the next FlowNode to execute
      const decoratedFlowNodeId: string = this._decoratedHandler.getFlowNode().id;
      processTokenFacade.addResultForFlowNode(decoratedFlowNodeId, token.payload);
      processTokenFacade.addResultForFlowNode(this.timerBoundaryEvent.id, token.payload);

      const nextNodeAfterBoundaryEvent: Model.Base.FlowNode = processModelFacade.getNextFlowNodeFor(this.timerBoundaryEvent);
      resolveFunc(new NextFlowNodeInfo(nextNodeAfterBoundaryEvent, token, processTokenFacade));
    };

    this.timerSubscription = this._timerFacade.initializeTimer(this.timerBoundaryEvent, timerType, timerValue, timerElapsed);
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
