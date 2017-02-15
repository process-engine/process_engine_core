import { ExecutionContext, IFactory, IInheritedSchema, IEntity } from '@process-engine-js/core_contracts';
import { Entity, IEntityType, IPropertyBag, IEncryptionService } from '@process-engine-js/data_model_contracts';
import { IInvoker } from '@process-engine-js/invocation_contracts';
import { IProcessTokenEntity, IProcessEntity } from '@process-engine-js/process_engine_contracts';
export declare class ProcessTokenEntity extends Entity implements IProcessTokenEntity {
    constructor(propertyBagFactory: IFactory<IPropertyBag>, encryptionService: IEncryptionService, invoker: IInvoker, entityType: IEntityType<IProcessTokenEntity>, context: ExecutionContext, schema: IInheritedSchema);
    initialize(derivedClassInstance: IEntity): Promise<void>;
    data: any;
    process: IProcessEntity;
    getProcess(): Promise<IProcessEntity>;
}
