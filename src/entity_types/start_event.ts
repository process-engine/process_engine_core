import {ExecutionContext, IEntity, IInheritedSchema} from '@essential-projects/core_contracts';
import {EntityDependencyHelper, IEntityType, IPropertyBag} from '@essential-projects/data_model_contracts';
import {IStartEventEntity} from '@process-engine/process_engine_contracts';
import {EventEntity} from './event';
import {NodeInstanceEntityDependencyHelper} from './node_instance';

export class StartEventEntity extends EventEntity implements IStartEventEntity {

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

  public async execute(context: ExecutionContext): Promise<void> {

    if (!!this.nodeDef.belongsToSubProcessKey) {
      this.processToken.data.current = this.processToken.parentProcessToken.data.current;
    }

    await super.execute(context);
  }
}
