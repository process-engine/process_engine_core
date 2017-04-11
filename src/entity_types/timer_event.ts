import {EventEntity} from './event';
import {EntityDependencyHelper} from '@process-engine-js/data_model_contracts';
import {ExecutionContext, SchemaAttributeType, IEntity, IInheritedSchema, IEntityReference} from '@process-engine-js/core_contracts';
import {ITimerEventEntity, TimerDefinitionType} from '@process-engine-js/process_engine_contracts';
import {ITimingService} from '@process-engine-js/timing_contracts';
import {schemaAttribute} from '@process-engine-js/metadata';
import {NodeInstanceEntityDependencyHelper} from './node_instance';

import * as moment from 'moment';

export class TimerEventEntity extends EventEntity implements ITimerEventEntity {

  private _timingService: ITimingService = undefined;

  constructor(timingService: ITimingService,
              nodeInstanceEntityDependencyHelper: NodeInstanceEntityDependencyHelper, 
              entityDependencyHelper: EntityDependencyHelper, 
              context: ExecutionContext,
              schema: IInheritedSchema) {
    super(nodeInstanceEntityDependencyHelper, entityDependencyHelper, context, schema);

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
    await this._startTimer(this.timerDefinitionType, this.timerDefinition, context);
  }

  public async proceed(context: ExecutionContext, data: any, source: IEntityReference, applicationId: string): Promise<void> {
    if (this.timerDefinitionType === TimerDefinitionType.cycle) {
      await this.event(context, 'timer', {});
    } else {
      await this.changeState(context, 'end', this);
    }
  }

  private async _startTimer(timerDefinitionType: TimerDefinitionType, timerDefinition: string, context: ExecutionContext): Promise<void> {
    switch (timerDefinitionType) {
      case TimerDefinitionType.cycle: await this._startCycleTimer(timerDefinition, context);
      case TimerDefinitionType.date: await this._startDateTimer(timerDefinition, context);
      case TimerDefinitionType.duration: await this._startDurationTimer(timerDefinition, context);
      default: return;
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
    }

    const channelName = `events/timer/${this.id}`;
    await this._prepareStartTimer(channelName, context);

    await this.timingService.periodic(timingRule, channelName, context);
  }

  private async _startDurationTimer(timerDefinition: string, context: ExecutionContext): Promise<void> {

    const duration = moment.duration(timerDefinition);
    const date = moment().add(duration);

    const channelName = `events/timer/${this.id}`;
    await this._prepareStartTimer(channelName, context);

    await this.timingService.once(date, channelName, context);
  }

  private async _startDateTimer(timerDefinition: string, context: ExecutionContext): Promise<void> {

    const date = moment(timerDefinition);

    const channelName = `events/timer/${this.id}`;
    await this._prepareStartTimer(channelName, context);

    await this.timingService.once(date, channelName, context);
  }

  private async _prepareStartTimer(channelName: string, context: ExecutionContext): Promise<void> {

    this.eventAggregator.subscribeOnce(channelName, async () => {
      await this._timerElapsed(context);
    });

    await this.changeState(context, 'wait', this);
  }

  private async _timerElapsed(context: ExecutionContext): Promise<void> {

    const data = {
      action: 'proceed'
    };

    const message = this.messageBusService.createEntityMessage(data, this, context);

    await this.messageBusService.publish(`/processengine/node/${this.id}`, message);
  }
}
