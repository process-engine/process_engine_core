import {EventEntity} from './event';
import {EntityDependencyHelper} from '@process-engine-js/data_model_contracts';
import {ExecutionContext, SchemaAttributeType, IEntity, IInheritedSchema} from '@process-engine-js/core_contracts';
import {ITimerEventEntity, TimerDefinitionType} from '@process-engine-js/process_engine_contracts';
import {IEventAggregator} from '@process-engine-js/event_aggregator_contracts';
import {ITimingService} from '@process-engine-js/timing_contracts'
import {schemaAttribute} from '@process-engine-js/metadata';
import {NodeInstanceEntityDependencyHelper} from './node_instance';

import * as moment from 'moment';

export class TimerEventEntity extends EventEntity implements ITimerEventEntity {

  private _timingService: ITimingService = undefined;
  private _eventAggregator: IEventAggregator = undefined;

  constructor(timingService: ITimingService,
              eventAggregator: IEventAggregator,
              nodeInstanceEntityDependencyHelper: NodeInstanceEntityDependencyHelper, 
              entityDependencyHelper: EntityDependencyHelper, 
              context: ExecutionContext,
              schema: IInheritedSchema) {
    super(nodeInstanceEntityDependencyHelper, entityDependencyHelper, context, schema);

    this._timingService = timingService;
    this._eventAggregator = eventAggregator;
  }

  private get timingService(): ITimingService {
    return this._timingService;
  }

  private get eventAggregator(): IEventAggregator {
    return this._eventAggregator;
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

  private async _startTimer(timerDefinitionType: TimerDefinitionType, timerDefinition: string): Promise<void> {

    // if (timerDefinitionType === TimerDefinitionType.cycle) {

    // } else {

    //   const targetDateTime = joda.LocalDateTime.parse(timerDefinition);

    //   this.timingService.once()
    // }
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

    this.eventAggregator.subscribe(channelName, async () => {

      const data = {};
      const message = this.messageBusService.createEntityMessage(data, this, context);
      
      await this.changeState(context, 'end', this);

      await this.messageBusService.publish(channelName, message);
    });

    await this.timingService.periodic(timingRule, channelName, context);
  }

  private async _startDurationTimer(timerDefinition: string, context: ExecutionContext): Promise<void> {

    const duration = moment.duration(timerDefinition);
    const date = moment().add(duration).toDate();

    const channelName = `events/timer/${this.id}`;

    this.eventAggregator.subscribeOnce(channelName, async () => {

      const data = {};
      const message = this.messageBusService.createEntityMessage(data, this, context);
      
      await this.changeState(context, 'end', this);

      await this.messageBusService.publish(channelName, message);
    });

    await this.timingService.once(date, channelName, context);
  }

  private async _startDateTimer(timerDefinition: string, context: ExecutionContext): Promise<void> {

    const date = moment(timerDefinition).toDate();

    const channelName = `events/timer/${this.id}`;

    this.eventAggregator.subscribeOnce(channelName, async () => {

      const data = {};
      const message = this.messageBusService.createEntityMessage(data, this, context);
      
      await this.changeState(context, 'end', this);

      await this.messageBusService.publish(channelName, message);
    });

    await this.timingService.once(date, channelName, context);
  }

  public async execute(context: ExecutionContext): Promise<void> {

    await this._startTimer(this.timerDefinitionType, this.timerDefinition);


    

    const internalContext = await this.iamService.createInternalContext('processengine_system');
    this.state = 'progress';
    await this.save(internalContext);

    const processToken = await this.getProcessToken(internalContext);
    const currentToken = processToken.data.current;
    const data = {
      action: 'endEvent',
      data: currentToken
    };


    const msg = this.messageBusService.createEntityMessage(data, this, context);
    if (this.participant) {
      await this.messageBusService.publish('/participant/' + this.participant, msg);
    } else {
      // send message to users of lane role
      const role = await this.getLaneRole(internalContext);
      await this.messageBusService.publish('/role/' + role, msg);
    }

    await this.changeState(context, 'end', this);
  }
}
