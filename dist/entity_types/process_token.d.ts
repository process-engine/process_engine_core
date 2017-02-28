import { IEntity } from '@process-engine-js/core_contracts';
import { Entity, EntityDependencyHelper } from '@process-engine-js/data_model_contracts';
import { IProcessTokenEntity, IProcessEntity } from '@process-engine-js/process_engine_contracts';
export declare class ProcessTokenEntity extends Entity implements IProcessTokenEntity {
    constructor(entityDependencyHelper: EntityDependencyHelper);
    initialize(derivedClassInstance: IEntity): Promise<void>;
    data: any;
    process: IProcessEntity;
    getProcess(): Promise<IProcessEntity>;
}
