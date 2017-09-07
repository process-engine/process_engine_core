import { ExecutionContext, IEntity, IInheritedSchema } from '@process-engine-js/core_contracts';
import { EntityDependencyHelper, IEntityType, IPropertyBag } from '@process-engine-js/data_model_contracts';
import { IUserTaskEntity } from '@process-engine-js/process_engine_contracts';
import { NodeInstanceEntity, NodeInstanceEntityDependencyHelper } from './node_instance';
export declare class UserTaskEntity extends NodeInstanceEntity implements IUserTaskEntity {
    constructor(nodeInstanceEntityDependencyHelper: NodeInstanceEntityDependencyHelper, entityDependencyHelper: EntityDependencyHelper, context: ExecutionContext, schema: IInheritedSchema, propertyBag: IPropertyBag, entityType: IEntityType<IEntity>);
    initialize(): Promise<void>;
    execute(context: ExecutionContext): Promise<void>;
    proceed(context: ExecutionContext, newData: any, source: IEntity, applicationId: string, participant: string): Promise<void>;
}
