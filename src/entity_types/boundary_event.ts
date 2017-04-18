import {EventEntity} from './event';
import {EntityDependencyHelper} from '@process-engine-js/data_model_contracts';
import {ExecutionContext, SchemaAttributeType, IEntity, IInheritedSchema, IEntityReference} from '@process-engine-js/core_contracts';
import {IBoundaryEventEntity, TimerDefinitionType} from '@process-engine-js/process_engine_contracts';
import {schemaAttribute} from '@process-engine-js/metadata';
import {NodeInstanceEntityDependencyHelper} from './node_instance';

export class BoundaryEventEntity extends EventEntity implements IBoundaryEventEntity {

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

  public async proceed(context: ExecutionContext, data: any, source: IEntityReference, applicationId: string): Promise<void> {

    await this.nodeDef.getAttachedToNode(context);

    const targetId = this.nodeDef.attachedToNode.id;

    let event;

    if (this.timerDefinitionType !== TimerDefinitionType.cycle || this.nodeDef.cancelActivity) {
      
      event = {
        action: 'changeState',
        data: 'end'
      };
      
    } else {

      event = {
        action: 'event',
        data: {
          event: 'timer',
          data: {}
        }
      };
    }

    this.eventAggregator.publish('/processengine/node/' + targetId, event);
  }
}
