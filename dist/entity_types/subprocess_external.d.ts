import { NodeInstanceEntity } from './node_instance';
import { ExecutionContext, IFactory, IInheritedSchema, IEntity } from '@process-engine-js/core_contracts';
import { IEntityType, IPropertyBag, IEncryptionService } from '@process-engine-js/data_model_contracts';
import { IInvoker } from '@process-engine-js/invocation_contracts';
import { ISubprocessExternalEntity } from '@process-engine-js/process_engine_contracts';
export declare class SubprocessExternalEntity extends NodeInstanceEntity implements ISubprocessExternalEntity {
    constructor(nodeInstanceHelper: any, propertyBagFactory: IFactory<IPropertyBag>, encryptionService: IEncryptionService, invoker: IInvoker, entityType: IEntityType<ISubprocessExternalEntity>, context: ExecutionContext, schema: IInheritedSchema);
    initialize(derivedClassInstance: IEntity): Promise<void>;
}
