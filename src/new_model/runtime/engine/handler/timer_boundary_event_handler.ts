// tslint:disable:max-line-length
import {ExecutionContext, IIamService} from '@essential-projects/core_contracts';
import {IEventAggregator, ISubscription} from '@essential-projects/event_aggregator_contracts';
import {ITimingRule, ITimingService} from '@essential-projects/timing_contracts';
import {IExecutionContextFascade, IProcessModelFascade, IProcessTokenFascade, Model, NextFlowNodeInfo,
  Runtime, TimerDefinitionType} from '@process-engine/process_engine_contracts';
import {FlowNodeHandler} from './index';

import * as moment from 'moment';
import * as uuid from 'uuid';

export class TimerBoundaryEventHandler extends FlowNodeHandler<Model.Base.FlowNode> {
  private _timingService: ITimingService;
  private _eventAggregator: IEventAggregator;
  private _iamService: IIamService;
  private _decoratedHandler: FlowNodeHandler<Model.Base.FlowNode>;

  constructor(timingService: ITimingService,
              eventAggregator: IEventAggregator,
              iamService: IIamService,
              decoratedHandler: FlowNodeHandler<Model.Base.FlowNode>) {
    super();
    this._timingService = timingService;
    this._eventAggregator = eventAggregator;
    this._iamService = iamService;
    this._decoratedHandler = decoratedHandler;
  }

  private get timingService(): ITimingService {
    return this._timingService;
  }

  private get eventAggregator(): IEventAggregator {
    return this._eventAggregator;
  }

  private get iamService(): IIamService {
    return this._iamService;
  }

  private get decoratedHandler(): FlowNodeHandler<Model.Base.FlowNode> {
    return this._decoratedHandler;
  }

  protected async executeIntern(flowNode: Model.Base.FlowNode,
                                processTokenFascade: IProcessTokenFascade,
                                processModelFascade: IProcessModelFascade,
                                executionContextFascade: IExecutionContextFascade): Promise < NextFlowNodeInfo > {

    return new Promise < NextFlowNodeInfo > (async(resolve: Function, reject: Function): Promise < NextFlowNodeInfo > => {

      let timerSubscription: ISubscription;

      try {

        const boundaryEvent: Model.Events.BoundaryEvent = this._getTimerBoundaryEvent(flowNode, processModelFascade);

        const timerType: TimerDefinitionType = this._parseTimerDefinitionType(boundaryEvent.timerEventDefinition);
        const timerValue: string = this._parseTimerDefinitionValue(boundaryEvent.timerEventDefinition);

        let timerHasElapsed: boolean = false;
        let hasHandlerFinished: boolean = false;

        const timerElapsed: any = async(): Promise < void > => {
          if (hasHandlerFinished) {
            return;
          }
          timerHasElapsed = true;

          // if the timer elapsed before the decorated handler finished execution,
          // the TimerBoundaryEvent will be used to determine the next FlowNode to execute

          const token: any = await processTokenFascade.getOldTokenFormat();
          await processTokenFascade.addResultForFlowNode(boundaryEvent.id, token.current);

          const nextNodeAfterBoundaryEvent: Model.Base.FlowNode = processModelFascade.getNextFlowNodeFor(boundaryEvent);
          resolve(new NextFlowNodeInfo(nextNodeAfterBoundaryEvent, processTokenFascade));
        };

        timerSubscription = await this._initializeTimer(boundaryEvent, timerType, timerValue, timerElapsed);

        const nextFlowNodeInfo: NextFlowNodeInfo = await this.decoratedHandler.execute(flowNode, processTokenFascade, processModelFascade, executionContextFascade);

        if (timerHasElapsed) {
          return;
        }

        // if the decorated handler finished execution before the timer elapsed,
        // continue the regular execution with the next FlowNode and dispose the timer

        hasHandlerFinished = true;
        resolve(nextFlowNodeInfo);

      } finally {
        timerSubscription.dispose();
      }
    });
  }

  private _getTimerBoundaryEvent(flowNode: Model.Base.FlowNode, processModelFascade: IProcessModelFascade): Model.Events.BoundaryEvent {

    const boundaryEvents: Array < Model.Events.BoundaryEvent > = processModelFascade.getBoundaryEventsFor(flowNode);

    const boundaryEvent: Model.Events.BoundaryEvent = boundaryEvents.find((currentBoundaryEvent: Model.Events.BoundaryEvent) => {
      return currentBoundaryEvent.timerEventDefinition !== undefined;
    });

    return boundaryEvent;
  }

  private async _initializeTimer(flowNode: Model.Events.BoundaryEvent,
                                 timerType: TimerDefinitionType,
                                 timerValue: string,
                                 timerCallback: Function): Promise < ISubscription > {

    const callbackEventName: string = `${flowNode.id}_${uuid.v4()}`;

    const context: any = await this.iamService.createInternalContext('processengine_system');

    switch (timerType) {
      case TimerDefinitionType.cycle:
        return this._startCycleTimer(timerValue, timerCallback, callbackEventName, context);
      case TimerDefinitionType.date:
        return this._startDateTimer(timerValue, timerCallback, callbackEventName, context);
      case TimerDefinitionType.duration:
        return this._startDurationTimer(timerValue, timerCallback, callbackEventName, context);
      default:
    }
  }

  private _parseTimerDefinitionType(eventDefinition: any): TimerDefinitionType {
    if (eventDefinition['bpmn:timeDuration']) {
      return TimerDefinitionType.duration;
    }
    if (eventDefinition['bpmn:timeCycle']) {
      return TimerDefinitionType.cycle;
    }
    if (eventDefinition['bpmn:timeDate']) {
      return TimerDefinitionType.date;
    }

    return undefined;
  }

  private _parseTimerDefinitionValue(eventDefinition: any): string {
    if (eventDefinition['bpmn:timeDuration']) {
      return eventDefinition['bpmn:timeDuration']._;
    }
    if (eventDefinition['bpmn:timeCycle']) {
      return eventDefinition['bpmn:timeCycle']._;
    }
    if (eventDefinition['bpmn:timeDate']) {
      return eventDefinition['bpmn:timeDate']._;
    }

    return undefined;
  }

  private async _startCycleTimer(timerDefinition: string,
                                 timerCallback: Function,
                                 callbackEventName: string,
                                 context: ExecutionContext): Promise < ISubscription > {

    const duration: moment.Duration = moment.duration(timerDefinition);

    const timingRule: ITimingRule = {
      year: duration.years(),
      month: duration.months(),
      date: duration.days(),
      hour: duration.hours(),
      minute: duration.minutes(),
      second: duration.seconds(),
    };

    const subscription: ISubscription = this.eventAggregator.subscribeOnce(callbackEventName, () => {
      timerCallback();
    });

    await this.timingService.periodic(timingRule, callbackEventName, context);

    return subscription;
  }

  private async _startDurationTimer(timerDefinition: string,
                                    timerCallback: Function,
                                    callbackEventName: string,
                                    context: ExecutionContext): Promise < ISubscription > {

    const duration: moment.Duration = moment.duration(timerDefinition);
    const date: moment.Moment = moment().add(duration);

    const subscription: ISubscription = this.eventAggregator.subscribeOnce(callbackEventName, () => {
      timerCallback();
    });

    await this.timingService.once(date, callbackEventName, context);

    return subscription;
  }

  private async _startDateTimer(timerDefinition: string,
                                timerCallback: Function,
                                callbackEventName: string,
                                context: ExecutionContext): Promise < ISubscription > {

    const date: moment.Moment = moment(timerDefinition);

    const subscription: ISubscription = this.eventAggregator.subscribeOnce(callbackEventName, () => {
      timerCallback();
    });

    await this.timingService.once(date, callbackEventName, context);

    return subscription;
  }
}
