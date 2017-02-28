import { NodeInstanceEntity, NodeInstanceEntityDependencyHelper } from './node_instance';
import { EntityDependencyHelper } from '@process-engine-js/data_model_contracts';
import { ExecutionContext, IEntity, IInheritedSchema } from '@process-engine-js/core_contracts';
import { ISubprocessInternalEntity } from '@process-engine-js/process_engine_contracts';
export declare class SubprocessInternalEntity extends NodeInstanceEntity implements ISubprocessInternalEntity {
    constructor(nodeInstanceEntityDependencyHelper: NodeInstanceEntityDependencyHelper, entityDependencyHelper: EntityDependencyHelper, context: ExecutionContext, schema: IInheritedSchema);
    initialize(derivedClassInstance: IEntity): Promise<void>;
}
