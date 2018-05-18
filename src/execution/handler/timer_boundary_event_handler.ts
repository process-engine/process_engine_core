import {ITimingRule, ITimingService} from '@essential-projects/timing_contracts';
import { Model, Runtime, TimerDefinitionType } from '@process-engine/process_engine_contracts';
import * as moment from 'moment';
import {
  IProcessModelFascade,
  IProcessTokenFascade,
  NextFlowNodeInfo,
} from './../../index';
import { FlowNodeHandler } from './index';

export class TimerBoundaryEventHandler extends FlowNodeHandler<Model.Events.BoundaryEvent> {
    private timingService: ITimingService;
    private activityHandler: FlowNodeHandler<Model.Base.FlowNode>;

    constructor(timingService: ITimingService, activityHandler: FlowNodeHandler<Model.Base.FlowNode>) {
        super();
        this.timingService = timingService;
        this.activityHandler = activityHandler;
    }

    protected async executeIntern(flowNode: Model.Events.BoundaryEvent, processTokenFascade: IProcessTokenFascade, processModelFascade: IProcessModelFascade): Promise<NextFlowNodeInfo> {

        return new Promise<NextFlowNodeInfo>(async(resolve: Function, reject: Function): Promise<NextFlowNodeInfo> => {

            try {

                const boundaryEvents: Array<Model.Events.BoundaryEvent> = processModelFascade.getBoundaryEventsFor(flowNode);

                const boundaryEvent: Model.Events.BoundaryEvent = boundaryEvents.find((currentBoundaryEvent: Model.Events.BoundaryEvent) => {
                    return currentBoundaryEvent.timerEventDefinition !== undefined;
                });

                const timerEventDefinition: any = boundaryEvent.timerEventDefinition;

                const timerType: TimerDefinitionType = this._parseTimerDefinitionType(timerEventDefinition);
                const timerValue: string = this._parseTimerDefinitionValue(timerEventDefinition);

                let hasTimerElapsed: boolean = false;
                let hasHandlerFinished: boolean = false;

                const timerElapsed: any = (): void => {
                    if (hasHandlerFinished) {
                        return;
                    }
                    hasTimerElapsed = true;
                    const nextNodeAfterBoundaryEvent: Model.Base.FlowNode = processModelFascade.getNextFlowNodeFor(boundaryEvent);
                    resolve(new NextFlowNodeInfo(nextNodeAfterBoundaryEvent, processTokenFascade));
                };

                await this._initializeTimer(timerType, timerValue, timerElapsed);

                const nextFlowNodeInfo: NextFlowNodeInfo = await this.activityHandler.execute(flowNode, processTokenFascade, processModelFascade);

                if (hasTimerElapsed) {
                    return;
                }

                hasHandlerFinished = true;
                resolve(nextFlowNodeInfo);
            } catch (err) {
                // const boundaryEvent: Model.Events.BoundaryEvent = processModelFascade.getBoundaryEventsFor(flowNode)[0];

                // if (!boundaryEvent) {
                //     throw err;
                // }

                // const nextFlowNode: Model.Base.FlowNode = processModelFascade.getNextFlowNodeFor(boundaryEvent);

                // return new NextFlowNodeInfo(nextFlowNode, processTokenFascade);
            }
        });
    }

    private async _initializeTimer(timerType: TimerDefinitionType, timerValue: string, timerCallback: Function): Promise<void> {

        setTimeout(timerCallback, 25000);

        // TODO: (SM) use the real TimingService for persistance - maybe also use EventAggregator instead of a functional callback

        // switch (timerType) {
        //     case TimerDefinitionType.cycle:
        //       await this.timingService.periodic(<ITimingRule> timerValue);
        //       break;
        //     case TimerDefinitionType.date:
        //       await this.timingService.once(<moment.Moment> timerValue);
        //       break;
        //     case TimerDefinitionType.duration:
        //       await this.timingService.once(<moment.Moment> timerValue);
        //       break;
        //     default: return;
        //   }
    }

    private _parseTimerDefinitionType(eventDefinition: any): TimerDefinitionType {
        if (eventDefinition.timeDuration) {
          return TimerDefinitionType.duration;
        }
        if (eventDefinition.timeCycle) {
          return TimerDefinitionType.cycle;
        }
        if (eventDefinition.timeDate) {
          return TimerDefinitionType.date;
        }

        return undefined;
    }

    private _parseTimerDefinitionValue(eventDefinition: any): string {
      if (eventDefinition.timeDuration) {
        return eventDefinition['bpmn:timeDuration']._;
      }
      if (eventDefinition.timeCycle) {
        return eventDefinition['bpmn:timeCycle']._;
      }
      if (eventDefinition.timeDate) {
        return eventDefinition['bpmn:timeDate']._;
      }

      return undefined;
    }
}
