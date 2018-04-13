import {ExecutionContext, IEntity, IInheritedSchema} from '@essential-projects/core_contracts';
import {EntityDependencyHelper, IEntityType, IPropertyBag} from '@essential-projects/data_model_contracts';
import {IBoundaryEventEntity, INodeInstanceEntity} from '@process-engine/process_engine_contracts';
import {EventEntity} from './event';
import {NodeInstanceEntityDependencyHelper} from './node_instance';

export class BoundaryEventEntity extends EventEntity implements IBoundaryEventEntity {

  public attachedToInstance: INodeInstanceEntity = undefined;

  constructor(nodeInstanceEntityDependencyHelper: NodeInstanceEntityDependencyHelper,
              entityDependencyHelper: EntityDependencyHelper,
              context: ExecutionContext,
              schema: IInheritedSchema,
              propertyBag: IPropertyBag,
              entityType: IEntityType<IEntity>) {
    super(nodeInstanceEntityDependencyHelper, entityDependencyHelper, context, schema, propertyBag, entityType);
  }

  public async initialize(): Promise<void> {
    await super.initialize(this);
  }

  public async execute(context: ExecutionContext) {

    const nodeDef = this.nodeDef;

    switch (nodeDef.eventType) {
      case 'bpmn:SignalEventDefinition':
        await this.initializeSignal();
        break;

      case 'bpmn:MessageEventDefinition':
        await this.initializeMessage();
        break;

      case 'bpmn:TimerEventDefinition':
        await this.initializeTimer();
        break;

      default:

    }
    this.changeState(context, 'wait', this);
  }

  public async proceed(context: ExecutionContext, data: any, source: INodeInstanceEntity, applicationId: string, participant: string): Promise<void> {
    const parent: INodeInstanceEntity = this.attachedToInstance;
    this.processToken = this.processToken.clone();
    await parent.triggerBoundaryEvent(context, this, data);
  }
}
