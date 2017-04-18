import { EventEntity } from './event';
import { EntityDependencyHelper } from '@process-engine-js/data_model_contracts';
import { ExecutionContext, IEntity, IInheritedSchema, IEntityReference } from '@process-engine-js/core_contracts';
import { ICatchEventEntity, TimerDefinitionType } from '@process-engine-js/process_engine_contracts';
import { NodeInstanceEntityDependencyHelper } from './node_instance';

export class CatchEventEntity extends EventEntity implements ICatchEventEntity {

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
    await this.changeState(context, 'end', this);
  }
}
