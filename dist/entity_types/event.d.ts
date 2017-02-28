import { NodeInstanceEntity } from './node_instance';
import { EntityDependencyHelper } from '@process-engine-js/data_model_contracts';
import { IEntity } from '@process-engine-js/core_contracts';
import { IEventEntity } from '@process-engine-js/process_engine_contracts';
import { NodeInstanceEntityDependencyHelper } from './node_instance';
export declare class EventEntity extends NodeInstanceEntity implements IEventEntity {
    constructor(nodeInstanceEntityDependencyHelper: NodeInstanceEntityDependencyHelper, entityDependencyHelper: EntityDependencyHelper);
    initialize(derivedClassInstance: IEntity): Promise<void>;
}
