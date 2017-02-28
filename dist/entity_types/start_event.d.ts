import { ExecutionContext, IEntity, IInheritedSchema } from '@process-engine-js/core_contracts';
import { EventEntity } from './event';
import { EntityDependencyHelper } from '@process-engine-js/data_model_contracts';
import { IStartEventEntity } from '@process-engine-js/process_engine_contracts';
import { NodeInstanceEntityDependencyHelper } from './node_instance';
export declare class StartEventEntity extends EventEntity implements IStartEventEntity {
    constructor(nodeInstanceEntityDependencyHelper: NodeInstanceEntityDependencyHelper, entityDependencyHelper: EntityDependencyHelper, context: ExecutionContext, schema: IInheritedSchema);
    initialize(derivedClassInstance: IEntity): Promise<void>;
}
