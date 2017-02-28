import { ExecutionContext, IEntity, IEntityReference, IInheritedSchema } from '@process-engine-js/core_contracts';
import { EntityDependencyHelper } from '@process-engine-js/data_model_contracts';
import { IUserTaskEntity } from '@process-engine-js/process_engine_contracts';
import { NodeInstanceEntity, NodeInstanceEntityDependencyHelper } from './node_instance';
export declare class UserTaskEntity extends NodeInstanceEntity implements IUserTaskEntity {
    constructor(nodeInstanceEntityDependencyHelper: NodeInstanceEntityDependencyHelper, entityDependencyHelper: EntityDependencyHelper, context: ExecutionContext, schema: IInheritedSchema);
    initialize(derivedClassInstance: IEntity): Promise<void>;
    execute(context: ExecutionContext): Promise<void>;
    proceed(context: ExecutionContext, newData: any, source: IEntityReference): Promise<void>;
}
