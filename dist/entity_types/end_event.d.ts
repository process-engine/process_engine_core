import { EventEntity } from './event';
import { EntityDependencyHelper } from '@process-engine-js/data_model_contracts';
import { IEntity } from '@process-engine-js/core_contracts';
import { IEndEventEntity } from '@process-engine-js/process_engine_contracts';
import { NodeInstanceEntityDependencyHelper } from './node_instance';
export declare class EndEventEntity extends EventEntity implements IEndEventEntity {
    constructor(nodeInstanceEntityDependencyHelper: NodeInstanceEntityDependencyHelper, entityDependencyHelper: EntityDependencyHelper);
    initialize(derivedClassInstance: IEntity): Promise<void>;
}
