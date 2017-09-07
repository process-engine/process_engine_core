import {NodeInstanceEntity} from './node_instance';
import {EntityDependencyHelper, IPropertyBag} from '@process-engine-js/data_model_contracts';
import {ExecutionContext, IEntity, IInheritedSchema} from '@process-engine-js/core_contracts';
import {IEventEntity, INodeInstanceEntity, TimerDefinitionType} from '@process-engine-js/process_engine_contracts';
import { IMessageSubscription } from '@process-engine-js/messagebus_contracts';
import { ISubscription } from '@process-engine-js/event_aggregator_contracts';
import {NodeInstanceEntityDependencyHelper} from './node_instance';

import * as moment from 'moment';
import * as debug from 'debug';
const debugInfo = debug('processengine:info');

export class EventEntity extends NodeInstanceEntity implements IEventEntity {

  public config: any = undefined;
  private _subscription: IMessageSubscription | ISubscription = undefined;

  constructor(nodeInstanceEntityDependencyHelper: NodeInstanceEntityDependencyHelper,
              entityDependencyHelper: EntityDependencyHelper,
              context: ExecutionContext,
              schema: IInheritedSchema,
              propertyBag: IPropertyBag) {
    super(nodeInstanceEntityDependencyHelper, entityDependencyHelper, context, schema, propertyBag);
  }

  public async initialize(derivedClassInstance: IEntity): Promise<void> {
    await super.initialize(derivedClassInstance);
  }

  protected async initializeTimer(): Promise<void> {

    const internalContext = await this.iamService.createInternalContext('processengine_system');

    switch (this.nodeDef.timerDefinitionType) {
      case TimerDefinitionType.cycle:
        await this._startCycleTimer(this.nodeDef.timerDefinition, internalContext);
        break;
      case TimerDefinitionType.date:
        await this._startDateTimer(this.nodeDef.timerDefinition, internalContext);
        break;
      case TimerDefinitionType.duration:
        await this._startDurationTimer(this.nodeDef.timerDefinition, internalContext);
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
    this._subscription = this.eventAggregator.subscribe(channelName, () => {
      this._handleTimerElapsed(context);
    });

    await this.timingService.periodic(timingRule, channelName, context);
  }

  private async _startDurationTimer(timerDefinition: string, context: ExecutionContext): Promise<void> {

    const duration = moment.duration(timerDefinition);
    const date = moment().add(duration);

    const channelName = `events/timer/${this.id}`;
    this._subscription = this.eventAggregator.subscribeOnce(channelName, () => {
      this._handleTimerElapsed(context);
    });

    await this.timingService.once(date, channelName, context);
  }

  private async _startDateTimer(timerDefinition: string, context: ExecutionContext): Promise<void> {

    const date = moment(timerDefinition);

    const channelName = `events/timer/${this.id}`;
    this._subscription = this.eventAggregator.subscribeOnce(channelName, () => {
      this._handleTimerElapsed(context);
    });

    await this.timingService.once(date, channelName, context);
  }

  private _handleTimerElapsed(context: ExecutionContext): void {
    this._sendProceed(context, null, this);
  }

  private _sendProceed(context: ExecutionContext, data: any, source: INodeInstanceEntity): void {
    data = data || {};
    data.action = 'proceed';

    const event = this.eventAggregator.createEntityEvent(data, source, context, (source && ('participant' in source) ? { participantId: source.participant } : null ));
    this.eventAggregator.publish('/processengine/node/' + this.id, event);
  }

  protected async initializeSignal(): Promise<void> {
    const signal = this.nodeDef.signal;
    const binding = {
      entity: this,
      eventAggregator: this.eventAggregator,
      messagebusService: this.messageBusService,
      datastoreService: (await this.getDatastoreService())
    };
    this._subscription = await this.messageBusService.subscribe('/processengine/signal/' + signal, this._signalHandler.bind(binding));
  }

  private async _signalHandler(msg: any) {
    const binding = <any>this;

    await binding.messagebusService.verifyMessage(msg);

    const context = (msg && msg.metadata && msg.metadata.context) ? msg.metadata.context : {};

    const sourceRef = (msg && msg.source) ? msg.source : null;
    let source = null;
    if (sourceRef) {

      const sourceProcessRef = msg && msg.data && msg.data.process ? msg.data.process : undefined;

      if (sourceProcessRef) {
        if (binding.entity.processEngineService.activeInstances.hasOwnProperty(sourceProcessRef.id)) {
          const sourceProcess = binding.entity.processEngineService.activeInstances[sourceProcessRef.id];
          source = sourceProcess.allInstances[sourceRef.id];
        }
      }

      if (!source) {
        const entityType = await binding.datastoreService.getEntityType(sourceRef._meta.type);
        try {
          source = await entityType.getById(sourceRef.id, context);
        } catch (err) {
          // source could not be found, ignore atm
        }
      }
    }

    const data: any = (msg && msg.data) ? msg.data : null;

    debugInfo(`signal '${binding.entity.nodeDef.signal}' received for node key '${binding.entity.key}'`);
    binding.entity._sendProceed(context, data, source);
  }

  protected async initializeMessage(): Promise<void> {
    const message = this.nodeDef.message;
    const binding = {
      entity: this,
      eventAggregator: this.eventAggregator,
      messagebusService: this.messageBusService,
      datastoreService: (await this.getDatastoreService())
    };
    this._subscription = await this.messageBusService.subscribe('/processengine/message/' + message, this._messageHandler.bind(binding));

  }

  private async _messageHandler(msg: any) {
    const binding = <any>this;

    await binding.messagebusService.verifyMessage(msg);

    const context = (msg && msg.metadata && msg.metadata.context) ? msg.metadata.context : {};

    const sourceRef = (msg && msg.source) ? msg.source : null;
    let source = null;
    if (sourceRef) {
      const entityType = await binding.datastoreService.getEntityType(sourceRef._meta.type);
      try {
        source = await entityType.getById(sourceRef.id, context);
      } catch (err) {
        // source could not be found
        // Todo: try to resolve source with unsafed node instance entities
      }
    }

    const data: any = (msg && msg.data) ? msg.data : null;

    debugInfo(`message '${binding.entity.nodeDef.message}' received for node key '${binding.entity.key}'`);

    binding.entity._sendProceed(context, data, source);
  }

  public dispose(): void {
    if (this._subscription) {
      this._subscription.dispose();
    }
  }
}
