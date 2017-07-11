import {EventEntity} from './event';
import {EntityDependencyHelper} from '@process-engine-js/data_model_contracts';
import {ExecutionContext, IEntity, IInheritedSchema} from '@process-engine-js/core_contracts';
import {IBoundaryEventEntity, INodeInstanceEntity} from '@process-engine-js/process_engine_contracts';
import {NodeInstanceEntityDependencyHelper} from './node_instance';

export class BoundaryEventEntity extends EventEntity implements IBoundaryEventEntity {

  public attachedToInstance: INodeInstanceEntity = undefined;

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

  public async execute(context: ExecutionContext) {

    const nodeDef = this.nodeDef;

    switch (nodeDef.eventType) {
      case 'bpmn:SignalEventDefinition':
        this.changeState(context, 'wait', this);
        await this.initializeSignal();
        break;

      case 'bpmn:MessageEventDefinition':
        this.changeState(context, 'wait', this);
        await this.initializeMessage();
        break;

      case 'bpmn:TimerEventDefinition':
        this.changeState(context, 'wait', this);
        await this.initializeTimer();
        break;

      default:
        this.changeState(context, 'end', this);
    }

  }

  public async proceed(context: ExecutionContext, data: any, source: INodeInstanceEntity, applicationId: string, participant: string): Promise<void> {

    const target = this.attachedToInstance;
    const payload = {
      action: 'event',
      event: 'timer',
      data: {}
    };

    const event = this.eventAggregator.createEntityEvent(payload, source, context, (source && ('participant' in source) ? { participantId: source.participant } : null ));
    this.eventAggregator.publish('/processengine/node/' + target.id, event);
  }
}
