import {IEventAggregator, ISubscription} from '@essential-projects/event_aggregator_contracts';
import {ITimerService, TimerRule} from '@essential-projects/timing_contracts';
import {
  IExecutionContextFacade,
  IProcessModelFacade,
  IProcessTokenFacade,
  Model,
  NextFlowNodeInfo,
  Runtime,
  TimerDefinitionType,
} from '@process-engine/process_engine_contracts';

import {FlowNodeHandler} from './index';

import * as moment from 'moment';
import * as uuid from 'uuid';

enum TimerBpmnType {
  Duration = 'bpmn:timeDuration',
  Cycle = 'bpmn:timeCycle',
  Date = 'bpmn:timeDate',
}

export class TimerBoundaryEventHandler extends FlowNodeHandler<Model.Base.FlowNode> {
  private _timerService: ITimerService;
  private _eventAggregator: IEventAggregator;
  private _decoratedHandler: FlowNodeHandler<Model.Base.FlowNode>;

  constructor(timerService: ITimerService,
              eventAggregator: IEventAggregator,
              decoratedHandler: FlowNodeHandler<Model.Base.FlowNode>) {
    super();
    this._timerService = timerService;
    this._eventAggregator = eventAggregator;
    this._decoratedHandler = decoratedHandler;
  }

  private get timerService(): ITimerService {
    return this._timerService;
  }

  private get eventAggregator(): IEventAggregator {
    return this._eventAggregator;
  }

  private get decoratedHandler(): FlowNodeHandler<Model.Base.FlowNode> {
    return this._decoratedHandler;
  }

  protected async executeInternally(flowNodeInfo: NextFlowNodeInfo<Model.Base.FlowNode>,
                                    token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    executionContextFacade: IExecutionContextFacade): Promise<NextFlowNodeInfo<Model.Base.FlowNode>> {

    const flowNode: Model.Base.FlowNode = flowNodeInfo.flowNode;

    return new Promise<NextFlowNodeInfo<Model.Base.FlowNode>> (
      async(resolve: Function, reject: Function): Promise<NextFlowNodeInfo<Model.Base.FlowNode>> => {

      let timerSubscription: ISubscription;

      try {

        const boundaryEvent: Model.Events.BoundaryEvent = this._getTimerBoundaryEvent(flowNode, processModelFacade);

        const timerType: TimerDefinitionType = this._parseTimerDefinitionType(boundaryEvent.timerEventDefinition);
        const timerValue: string = this._parseTimerDefinitionValue(boundaryEvent.timerEventDefinition);

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
          await processTokenFacade.addResultForFlowNode(boundaryEvent.id, oldTokenFormat.current);

          const nextNodeAfterBoundaryEvent: Model.Base.FlowNode = processModelFacade.getNextFlowNodeFor(boundaryEvent);
          resolve(new NextFlowNodeInfo(nextNodeAfterBoundaryEvent, token, processTokenFacade));
        };

        timerSubscription = await this._initializeTimer(boundaryEvent, timerType, timerValue, timerElapsed);

        const nextFlowNodeInfo: NextFlowNodeInfo<Model.Base.FlowNode> =
          await this.decoratedHandler.execute(flowNodeInfo,
                                              token,
                                              processTokenFacade,
                                              processModelFacade,
                                              executionContextFacade);

        if (timerHasElapsed) {
          return;
        }

        // if the decorated handler finished execution before the timer elapsed,
        // continue the regular execution with the next FlowNode and dispose the timer

        hasHandlerFinished = true;
        resolve(nextFlowNodeInfo);

      } finally {
        if (timerSubscription) {
          timerSubscription.dispose();
        }
      }
    });
  }

  private _getTimerBoundaryEvent(flowNode: Model.Base.FlowNode, processModelFacade: IProcessModelFacade): Model.Events.BoundaryEvent {

    const boundaryEvents: Array<Model.Events.BoundaryEvent> = processModelFacade.getBoundaryEventsFor(flowNode);

    const boundaryEvent: Model.Events.BoundaryEvent = boundaryEvents.find((currentBoundaryEvent: Model.Events.BoundaryEvent) => {
      return currentBoundaryEvent.timerEventDefinition !== undefined;
    });

    return boundaryEvent;
  }

  private async _initializeTimer(flowNode: Model.Events.BoundaryEvent,
                                 timerType: TimerDefinitionType,
                                 timerValue: string,
                                 timerCallback: Function): Promise<ISubscription> {

    const callbackEventName: string = `${flowNode.id}_${uuid.v4()}`;

    switch (timerType) {
      case TimerDefinitionType.cycle:
        return this._startCycleTimer(timerValue, timerCallback, callbackEventName);
      case TimerDefinitionType.date:
        return this._startDateTimer(timerValue, timerCallback, callbackEventName);
      case TimerDefinitionType.duration:
        return this._startDurationTimer(timerValue, timerCallback, callbackEventName);
      default:
    }
  }

  private _parseTimerDefinitionType(eventDefinition: any): TimerDefinitionType {
    if (eventDefinition[TimerBpmnType.Duration]) {
      return TimerDefinitionType.duration;
    }
    if (eventDefinition[TimerBpmnType.Cycle]) {
      return TimerDefinitionType.cycle;
    }
    if (eventDefinition[TimerBpmnType.Date]) {
      return TimerDefinitionType.date;
    }

    return undefined;
  }

  private _parseTimerDefinitionValue(eventDefinition: any): string {
    if (eventDefinition[TimerBpmnType.Duration]) {
      return eventDefinition[TimerBpmnType.Duration]._;
    }
    if (eventDefinition[TimerBpmnType.Cycle]) {
      return eventDefinition[TimerBpmnType.Cycle]._;
    }
    if (eventDefinition[TimerBpmnType.Date]) {
      return eventDefinition[TimerBpmnType.Date]._;
    }

    return undefined;
  }

  private async _startCycleTimer(timerDefinition: string,
                                 timerCallback: Function,
                                 callbackEventName: string): Promise<ISubscription> {

    const duration: moment.Duration = moment.duration(timerDefinition);

    const timingRule: TimerRule = {
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

    await this.timerService.periodic(timingRule, callbackEventName);

    return subscription;
  }

  private async _startDurationTimer(timerDefinition: string,
                                    timerCallback: Function,
                                    callbackEventName: string): Promise<ISubscription> {

    const duration: moment.Duration = moment.duration(timerDefinition);
    const date: moment.Moment = moment().add(duration);

    const subscription: ISubscription = this.eventAggregator.subscribeOnce(callbackEventName, () => {
      timerCallback();
    });

    await this.timerService.once(date, callbackEventName);

    return subscription;
  }

  private async _startDateTimer(timerDefinition: string,
                                timerCallback: Function,
                                callbackEventName: string): Promise<ISubscription> {

    const date: moment.Moment = moment(timerDefinition);

    const subscription: ISubscription = this.eventAggregator.subscribeOnce(callbackEventName, () => {
      timerCallback();
    });

    await this.timerService.once(date, callbackEventName);

    return subscription;
  }
}
