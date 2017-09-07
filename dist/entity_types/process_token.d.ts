import { ExecutionContext, IInheritedSchema } from '@process-engine-js/core_contracts';
import { Entity, EntityDependencyHelper, IPropertyBag } from '@process-engine-js/data_model_contracts';
import { IProcessTokenEntity, IProcessEntity } from '@process-engine-js/process_engine_contracts';
export declare class ProcessTokenEntity extends Entity implements IProcessTokenEntity {
    constructor(entityDependencyHelper: EntityDependencyHelper, context: ExecutionContext, schema: IInheritedSchema, propertyBag: IPropertyBag);
    initialize(): Promise<void>;
    data: any;
    process: IProcessEntity;
    getProcess(context: ExecutionContext): Promise<IProcessEntity>;
}
