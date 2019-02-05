import {Logger} from 'loggerhythm';

import {Subscription} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';
import {
  IProcessModelFacade,
  IProcessTokenFacade,
  ITimerFacade,
  Model,
  OnBoundaryEventTriggeredCallback,
  OnBoundaryEventTriggeredData,
  Runtime,
  TimerDefinitionType,
} from '@process-engine/process_engine_contracts';

import {BoundaryEventHandler} from './boundary_event_handler';

export class TimerBoundaryEventHandler extends BoundaryEventHandler {

  private readonly _timerFacade: ITimerFacade;

  private timerSubscription: Subscription;

  private readonly logger: Logger;

  constructor(timerFacade: ITimerFacade, processModelFacade: IProcessModelFacade, boundaryEventModel: Model.Events.BoundaryEvent) {
    super(processModelFacade, boundaryEventModel);
    this._timerFacade = timerFacade;
    this.logger = new Logger(`processengine:timer_boundary_event_handler:${boundaryEventModel.id}`);
  }

  public async waitForTriggeringEvent(
    token: Runtime.Types.ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    identity: IIdentity,
    onTriggeredCallback: OnBoundaryEventTriggeredCallback,
  ): Promise<void> {

    this.logger.verbose(`Initializing TimerBoundaryEvent for ProcessModel ${token.processModelId} in ProcessInstance ${token.processInstanceId}`);

    const timerType: TimerDefinitionType = this._timerFacade.parseTimerDefinitionType(this.boundaryEventModel.timerEventDefinition);
    const timerValueFromDefinition: string = this._timerFacade.parseTimerDefinitionValue(this.boundaryEventModel.timerEventDefinition);
    const timerValue: string = this._executeTimerExpressionIfNeeded(timerValueFromDefinition, processTokenFacade);

    const timerElapsed: any = async(): Promise<void> => {

      this.logger.verbose(`TimerBoundaryEvent for ProcessModel ${token.processModelId} in ProcessInstance ${token.processInstanceId} was triggered.`);

      const nextFlowNode: Model.Base.FlowNode = this.getNextFlowNode();

      const eventData: OnBoundaryEventTriggeredData = {
        nextFlowNode: nextFlowNode,
        interruptHandler: this.boundaryEventModel.cancelActivity,
        eventPayload: {},
      };

      onTriggeredCallback(eventData);
    };

    this.timerSubscription = this._timerFacade.initializeTimer(this.boundaryEventModel, timerType, timerValue, timerElapsed);
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
      this.logger.error('The expression provided with the TimerBoundaryEvent is invalid!');
      this.logger.error(err);
      throw err;
    }
  }

  public async cancel(): Promise<void> {
    this._timerFacade.cancelTimerSubscription(this.timerSubscription);
  }
}
