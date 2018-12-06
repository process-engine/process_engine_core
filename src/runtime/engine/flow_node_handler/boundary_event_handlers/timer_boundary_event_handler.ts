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
    this.logger = Logger.createLogger(`processengine:runtime:timer_boundary_event:${timerBoundaryEventModel.id}`);
  }

  private get timerBoundaryEvent(): Model.Events.BoundaryEvent {
    return super.flowNode;
  }

  protected async executeInternally(token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    identity: IIdentity): Promise<NextFlowNodeInfo> {

    return new Promise<NextFlowNodeInfo>(async(resolve: Function, reject: Function): Promise<NextFlowNodeInfo> => {

      let timerSubscription: ISubscription;

      const timerType: TimerDefinitionType = this._timerFacade.parseTimerDefinitionType(this.timerBoundaryEvent.timerEventDefinition);
      const timerValueFromDefinition: string = this._timerFacade.parseTimerDefinitionValue(this.timerBoundaryEvent.timerEventDefinition);
      const timerValue: string = await this._executeTimerExpressionIfNeeded(timerValueFromDefinition, processTokenFacade);

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
          await processTokenFacade.addResultForFlowNode(this.timerBoundaryEvent.id, token.payload);

          const nextNodeAfterBoundaryEvent: Model.Base.FlowNode = processModelFacade.getNextFlowNodeFor(this.timerBoundaryEvent);
          resolve(new NextFlowNodeInfo(nextNodeAfterBoundaryEvent, token, processTokenFacade));
        };

        timerSubscription = this._timerFacade.initializeTimer(this.timerBoundaryEvent, timerType, timerValue, timerElapsed);

        const nextFlowNodeInfo: NextFlowNodeInfo =
          await this._decoratedHandler.execute(token, processTokenFacade, processModelFacade, identity, this.previousFlowNodeInstanceId);

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

  protected async resumeInternally(flowNodeInstance: Runtime.Types.FlowNodeInstance,
                                   processTokenFacade: IProcessTokenFacade,
                                   processModelFacade: IProcessModelFacade,
                                   identity: IIdentity,
                                  ): Promise<NextFlowNodeInfo> {

    return new Promise<NextFlowNodeInfo> (async(resolve: Function, reject: Function): Promise<NextFlowNodeInfo> => {

      const onEnterToken: Runtime.Types.ProcessToken = flowNodeInstance.getTokenByType(Runtime.Types.ProcessTokenType.onEnter);

      let timerSubscription: ISubscription;

      const timerType: TimerDefinitionType = this._timerFacade.parseTimerDefinitionType(this.timerBoundaryEvent.timerEventDefinition);
      const timerValue: string = this._timerFacade.parseTimerDefinitionValue(this.timerBoundaryEvent.timerEventDefinition);

      try {

        let timerHasElapsed: boolean = false;
        let hasHandlerFinished: boolean = false;

        const timerElapsed: any = async(): Promise<void> => {
          if (hasHandlerFinished) {
            return;
          }
          timerHasElapsed = true;

          // if the timer elapsed before the decorated handler finished resumption,
          // the TimerBoundaryEvent will be used to determine the next FlowNode to execute
          await processTokenFacade.addResultForFlowNode(this.timerBoundaryEvent.id, onEnterToken.payload);

          const nextNodeAfterBoundaryEvent: Model.Base.FlowNode = processModelFacade.getNextFlowNodeFor(this.timerBoundaryEvent);
          resolve(new NextFlowNodeInfo(nextNodeAfterBoundaryEvent, onEnterToken, processTokenFacade));
        };

        timerSubscription = this._timerFacade.initializeTimer(this.timerBoundaryEvent, timerType, timerValue, timerElapsed);

        const nextFlowNodeInfo: NextFlowNodeInfo =
          await this._decoratedHandler.resume(flowNodeInstance, processTokenFacade, processModelFacade, identity);

        if (timerHasElapsed) {
          return;
        }

        // if the decorated handler finished resumption before the timer elapsed,
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
      this.logger.error(err);
      throw err;
    }
  }
}
