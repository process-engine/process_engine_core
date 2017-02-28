import { NodeInstanceEntity, NodeInstanceEntityDependencyHelper } from './node_instance';
import { EntityDependencyHelper } from '@process-engine-js/data_model_contracts';
import { IEntity } from '@process-engine-js/core_contracts';
import { ISubprocessExternalEntity } from '@process-engine-js/process_engine_contracts';
export declare class SubprocessExternalEntity extends NodeInstanceEntity implements ISubprocessExternalEntity {
    constructor(nodeInstanceEntityDependencyHelper: NodeInstanceEntityDependencyHelper, entityDependencyHelper: EntityDependencyHelper);
    initialize(derivedClassInstance: IEntity): Promise<void>;
}
