// TimerEvent is deprecated, timers are event definitions and no node instances. They are part of catch or boundary events.


/*
import {EntityDependencyHelper} from '@process-engine-js/data_model_contracts';
import {ExecutionContext, SchemaAttributeType, IEntity, IInheritedSchema, IEntityReference} from '@process-engine-js/core_contracts';
import {TimerDefinitionType} from '@process-engine-js/process_engine_contracts';
import {ITimingService} from '@process-engine-js/timing_contracts';
import {schemaAttribute} from '@process-engine-js/metadata';
import {NodeInstanceEntityDependencyHelper} from './node_instance';

import * as moment from 'moment';

export class TimerEventEntity {

  private _timingService: ITimingService = undefined;

  constructor(timingService: ITimingService,
              nodeInstanceEntityDependencyHelper: NodeInstanceEntityDependencyHelper, 
              entityDependencyHelper: EntityDependencyHelper, 
              context: ExecutionContext,
              schema: IInheritedSchema) {

    this._timingService = timingService;
  }

  private get timingService(): ITimingService {
    return this._timingService;
  }

  @schemaAttribute({ type: SchemaAttributeType.number })
  public get timerDefinitionType(): TimerDefinitionType {
    return this.getProperty(this, 'timerDefinitionType');
  }

  public set timerDefinitionType(value: TimerDefinitionType) {
    this.setProperty(this, 'timerDefinitionType', value);
  }

  @schemaAttribute({ type: SchemaAttributeType.string })
  public get timerDefinition(): string {
    return this.getProperty(this, 'timerDefinition');
  }

  public set timerDefinition(value: string) {
    this.setProperty(this, 'timerDefinition', value);
  }

  public async initialize(derivedClassInstance: IEntity): Promise<void> {
    const actualInstance = derivedClassInstance || this;
    await super.initialize(actualInstance);
  }

  public async execute(context: ExecutionContext): Promise<void> {
    
    switch (this.timerDefinitionType) {
      case TimerDefinitionType.cycle:
        await this._startCycleTimer(this.timerDefinition, context);
        break;
      case TimerDefinitionType.date:
        await this._startDateTimer(this.timerDefinition, context);
        break;
      case TimerDefinitionType.duration:
        await this._startDurationTimer(this.timerDefinition, context);
        break;
      default:
    }

    await this.changeState(context, 'wait', this);
  }

  public async proceed(context: ExecutionContext, data: any, source: IEntityReference, applicationId: string): Promise<void> {
    if (this.timerDefinitionType === TimerDefinitionType.cycle) {
      await this.event(context, 'timer', {});
    } else {
      await this.changeState(context, 'end', this);
    }
  }


  private async _startCycleTimer(timerDefinition: string, context: ExecutionContext): Promise<void> {

    const duration = moment.duration(timerDefinition);

    const timingRule = {
      year: duration.years(),
      month: duration.months(),
      date: duration.days(),
      hour: duration.hours(),
      minute: duration.minutes(),
      second: duration.seconds()
    };

    const channelName = `events/timer/${this.id}`;
    this.eventAggregator.subscribe(channelName, async () => {
      await this._timerElapsed(context);
    });

    await this.timingService.periodic(timingRule, channelName, context);
  }

  private async _startDurationTimer(timerDefinition: string, context: ExecutionContext): Promise<void> {

    const duration = moment.duration(timerDefinition);
    const date = moment().add(duration);

    const channelName = `events/timer/${this.id}`;
    this.eventAggregator.subscribeOnce(channelName, async () => {
      await this._timerElapsed(context);
    });

    await this.timingService.once(date, channelName, context);
  }

  private async _startDateTimer(timerDefinition: string, context: ExecutionContext): Promise<void> {

    const date = moment(timerDefinition);

    const channelName = `events/timer/${this.id}`;
    this.eventAggregator.subscribeOnce(channelName, async () => {
      await this._timerElapsed(context);
    });

    await this.timingService.once(date, channelName, context);
  }


  private async _timerElapsed(context: ExecutionContext): Promise<void> {

    const data = {
      action: 'proceed'
    };

    const event = this.eventAggregator.createEntityEvent(data, this, context);
    this.eventAggregator.publish('/processengine/node/' + this.id, event);
  }
}
*/
