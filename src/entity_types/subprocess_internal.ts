import {NodeInstanceEntity, NodeInstanceEntityDependencyHelper} from './node_instance';
import {EntityDependencyHelper, IEntityType, IPropertyBag} from '@process-engine-js/data_model_contracts';
import {ExecutionContext, IEntity, IInheritedSchema} from '@process-engine-js/core_contracts';
import {ISubprocessInternalEntity} from '@process-engine-js/process_engine_contracts';

export class SubprocessInternalEntity extends NodeInstanceEntity implements ISubprocessInternalEntity {

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
}
