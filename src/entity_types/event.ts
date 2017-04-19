import {NodeInstanceEntity} from './node_instance';
import {EntityDependencyHelper} from '@process-engine-js/data_model_contracts';
import {ExecutionContext, SchemaAttributeType, IEntity, IEntityReference, IInheritedSchema} from '@process-engine-js/core_contracts';
import {schemaAttribute} from '@process-engine-js/metadata';
import {IEventEntity, TimerDefinitionType} from '@process-engine-js/process_engine_contracts';
import {NodeInstanceEntityDependencyHelper} from './node_instance';

import * as moment from 'moment';

export class EventEntity extends NodeInstanceEntity implements IEventEntity {

  public config: any = undefined;

  constructor(nodeInstanceEntityDependencyHelper: NodeInstanceEntityDependencyHelper, 
              entityDependencyHelper: EntityDependencyHelper, 
              context: ExecutionContext,
              schema: IInheritedSchema) {
    super(nodeInstanceEntityDependencyHelper, entityDependencyHelper, context, schema);
  }

  public async initialize(derivedClassInstance: IEntity): Promise<void> {
    const actualInstance = derivedClassInstance || this;
    await super.initialize(actualInstance);
  }


  protected async initializeTimer(): Promise<void> {

    const context = await this.iamService.createInternalContext(this.config.systemUser);
        
    switch (this.nodeDef.timerDefinitionType) {
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
    this.eventAggregator.subscribe(channelName, () => {
      this._handleTimerElapsed(context);
    });

    await this.timingService.periodic(timingRule, channelName, context);
  }

  private async _startDurationTimer(timerDefinition: string, context: ExecutionContext): Promise<void> {

    const duration = moment.duration(timerDefinition);
    const date = moment().add(duration);

    const channelName = `events/timer/${this.id}`;
    this.eventAggregator.subscribeOnce(channelName, () => {
      this._handleTimerElapsed(context);
    });

    await this.timingService.once(date, channelName, context);
  }

  private async _startDateTimer(timerDefinition: string, context: ExecutionContext): Promise<void> {

    const date = moment(timerDefinition);

    const channelName = `events/timer/${this.id}`;
    this.eventAggregator.subscribeOnce(channelName, () => {
      this._handleTimerElapsed(context);
    });

    await this.timingService.once(date, channelName, context);
  }

  private _handleTimerElapsed(context: ExecutionContext): void {
    this._sendProceed(context, null, this);
  }


  private _sendProceed(context: ExecutionContext, data: any, source: IEntity): void {
    data = data || {};
    data.action = 'proceed';

    const event = this.eventAggregator.createEntityEvent(data, source, context);
    this.eventAggregator.publish('/processengine/node/' + this.id, event);
  }

  protected async initializeSignal(): Promise<void> {
    const signal = this.nodeDef.signal;
    const binding = {
      entity: this,
      eventAggregator: this.eventAggregator,
      messagebusService: this.messageBusService,
      datastoreService: this.datastoreService
    };
    this.messagebusSubscription = this.messageBusService.subscribe('/processengine/signal/' + signal, this._signalHandler.bind(binding));

  }

  private async _signalHandler(msg: any) {
    const binding = <any>this;

    await binding.messagebusService.verifyMessage(msg);

    const context = (msg && msg.metadata && msg.metadata.context) ? msg.metadata.context : {};

    const sourceRef = (msg && msg.source) ? msg.source : null;
    let source = null;
    if (sourceRef) {
      const entityType = await binding.datastoreService.getEntityType(sourceRef._meta.type);
      source = await entityType.getById(sourceRef.id, context);
    }

    const data: any = (msg && msg.data) ? msg.data : null;

    this._sendProceed(context, data, source);
  }

  protected async initializeMessage(): Promise<void> {
    const message = this.nodeDef.message;
    const binding = {
      entity: this,
      eventAggregator: this.eventAggregator,
      messagebusService: this.messageBusService,
      datastoreService: this.datastoreService
    };
    this.messagebusSubscription = this.messageBusService.subscribe('/processengine/message/' + message, this._messageHandler.bind(binding));

  }

  private async _messageHandler(msg: any) {
    const binding = <any>this;

    await binding.messagebusService.verifyMessage(msg);

    const context = (msg && msg.metadata && msg.metadata.context) ? msg.metadata.context : {};

    const sourceRef = (msg && msg.source) ? msg.source : null;
    let source = null;
    if (sourceRef) {
      const entityType = await binding.datastoreService.getEntityType(sourceRef._meta.type);
      source = await entityType.getById(sourceRef.id, context);
    }

    const data: any = (msg && msg.data) ? msg.data : null;

    this._sendProceed(context, data, source);
  }

}
