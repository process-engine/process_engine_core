import { EventEntity } from './event';
import { ExecutionContext, IFactory, IInheritedSchema, IEntity } from '@process-engine-js/core_contracts';
import { IEntityType, IPropertyBag, IEncryptionService } from '@process-engine-js/data_model_contracts';
import { IInvoker } from '@process-engine-js/invocation_contracts';
import { IBoundaryEventEntity } from '@process-engine-js/process_engine_contracts';
export declare class BoundaryEventEntity extends EventEntity implements IBoundaryEventEntity {
    constructor(nodeInstanceHelper: any, propertyBagFactory: IFactory<IPropertyBag>, encryptionService: IEncryptionService, invoker: IInvoker, entityType: IEntityType<IBoundaryEventEntity>, context: ExecutionContext, schema: IInheritedSchema);
    initialize(derivedClassInstance: IEntity): Promise<void>;
}
