import {NodeInstanceEntity} from './node_instance';
import {EntityDependencyHelper} from '@process-engine-js/data_model_contracts';
import {ExecutionContext, SchemaAttributeType, IEntity, IEntityReference, IInheritedSchema} from '@process-engine-js/core_contracts';
import {schemaAttribute} from '@process-engine-js/metadata';
import {IEventEntity, TimerDefinitionType} from '@process-engine-js/process_engine_contracts';
import {ITimingService} from '@process-engine-js/timing_contracts';
import {NodeInstanceEntityDependencyHelper} from './node_instance';

import * as moment from 'moment';

export class EventEntity extends NodeInstanceEntity implements IEventEntity {
  
  private _timingService: ITimingService = undefined;

  public config: any = undefined;

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

  protected get timerDefinitionType(): TimerDefinitionType {
    return this.nodeDef.timerDefinitionType;
  }

  protected get timerDefinition(): any {
    return this.nodeDef.timerDefinition;
  }

  public async initialize(derivedClassInstance: IEntity): Promise<void> {
    const actualInstance = derivedClassInstance || this;
    await super.initialize(actualInstance);
    await this.initializeTimer();
  }

  private async initializeTimer(): Promise<void> {

    const context = await this.iamService.createInternalContext(this.config.systemUser);
    
    await this.getNodeDef(context);
        
    switch (this.timerDefinitionType) {
      case TimerDefinitionType.cycle:
        await this._startCycleTimer(this.nodeDef.timerDefinition, context);
        break;
      case TimerDefinitionType.date:
        await this._startDateTimer(this.nodeDef.timerDefinition, context);
        break;
      case TimerDefinitionType.duration:
        await this._startDurationTimer(this.nodeDef.timerDefinition, context);
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
      await this.handleTimerElapsed(context);
    });

    await this.timingService.periodic(timingRule, channelName, context);
  }

  private async _startDurationTimer(timerDefinition: string, context: ExecutionContext): Promise<void> {

    const duration = moment.duration(timerDefinition);
    const date = moment().add(duration);

    const channelName = `events/timer/${this.id}`;
    this.eventAggregator.subscribeOnce(channelName, async () => {
      await this.handleTimerElapsed(context);
    });

    await this.timingService.once(date, channelName, context);
  }

  private async _startDateTimer(timerDefinition: string, context: ExecutionContext): Promise<void> {

    const date = moment(timerDefinition);

    const channelName = `events/timer/${this.id}`;
    this.eventAggregator.subscribeOnce(channelName, async () => {
      await this.handleTimerElapsed(context);
    });

    await this.timingService.once(date, channelName, context);
  }

  protected handleTimerElapsed(context: ExecutionContext): void {

    const data = {
      action: 'proceed'
    };

    const event = this.eventAggregator.createEntityEvent(data, this, context);
    this.eventAggregator.publish('/processengine/node/' + this.id, event);
  }
}