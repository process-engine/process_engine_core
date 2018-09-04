import * as moment from 'moment';
import * as uuid from 'uuid';

import {ITimerService, TimerRule} from '@essential-projects/timing_contracts';

import {
  IExecutionContextFacade,
  IFlowNodeInstanceService,
  IProcessModelFacade,
  IProcessTokenFacade,
  Model,
  NextFlowNodeInfo,
  Runtime,
  TimerDefinitionType,
} from '@process-engine/process_engine_contracts';

import {IEventAggregator, ISubscription} from '@essential-projects/event_aggregator_contracts';

import {FlowNodeHandler} from '../index';

enum TimerBpmnType {
  Duration = 'bpmn:timeDuration',
  Cycle = 'bpmn:timeCycle',
  Date = 'bpmn:timeDate',
}

export class IntermediateTimerCatchEventHandler extends FlowNodeHandler<Model.Events.IntermediateCatchEvent> {

  private _eventAggregator: IEventAggregator;
  private _flowNodeInstanceService: IFlowNodeInstanceService = undefined;
  private _timerService: ITimerService = undefined;

  constructor(eventAggregator: IEventAggregator,
              flowNodeInstanceService: IFlowNodeInstanceService,
              timerService: ITimerService) {

    super();
    this._eventAggregator = eventAggregator;
    this._flowNodeInstanceService = flowNodeInstanceService;
    this._timerService = timerService;
  }

  private get eventAggregator(): IEventAggregator {
    return this._eventAggregator;
  }

  private get flowNodeInstanceService(): IFlowNodeInstanceService {
    return this._flowNodeInstanceService;
  }

  private get timerService(): ITimerService {
    return this._timerService;
  }

  protected async executeInternally(flowNode: Model.Events.IntermediateCatchEvent,
                                    token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    executionContextFacade: IExecutionContextFacade): Promise<NextFlowNodeInfo> {

    await this.flowNodeInstanceService.persistOnEnter(flowNode.id, this.flowNodeInstanceId, token);
    await this.flowNodeInstanceService.suspend(flowNode.id, this.flowNodeInstanceId, token);

    return new Promise<NextFlowNodeInfo> (async(resolve: Function, reject: Function): Promise<void> => {

      let timerSubscription: ISubscription;

      const timerType: TimerDefinitionType = this._parseTimerDefinitionType(flowNode.timerEventDefinition);
      const timerValue: string = this._parseTimerDefinitionValue(flowNode.timerEventDefinition);

      const nextFlowNodeInfo: Model.Base.FlowNode = processModelFacade.getNextFlowNodeFor(flowNode);

      const timerElapsed: any = async(): Promise<void> => {

        const oldTokenFormat: any = await processTokenFacade.getOldTokenFormat();
        await processTokenFacade.addResultForFlowNode(flowNode.id, oldTokenFormat.current);

        await this.flowNodeInstanceService.resume(flowNode.id, this.flowNodeInstanceId, token);
        await this.flowNodeInstanceService.persistOnExit(flowNode.id, this.flowNodeInstanceId, token);

        if (timerSubscription && timerType !== TimerDefinitionType.cycle) {
          timerSubscription.dispose();
        }

        resolve(new NextFlowNodeInfo(nextFlowNodeInfo, token, processTokenFacade));
      };

      timerSubscription = await this._initializeTimer(flowNode, timerType, timerValue, timerElapsed);
    });
  }

  private async _initializeTimer(flowNode: Model.Events.IntermediateCatchEvent,
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

    const subscription: ISubscription = this.eventAggregator.subscribe(callbackEventName, () => {
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
