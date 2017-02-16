import { ExecutionContext, IFactory, IInheritedSchema, IEntity, IPublicGetOptions } from '@process-engine-js/core_contracts';
import { Entity, IEntityType, IPropertyBag, IEncryptionService } from '@process-engine-js/data_model_contracts';
import { IInvoker } from '@process-engine-js/invocation_contracts';
import { IProcessEntity, IProcessDefEntity, IParamStart } from '@process-engine-js/process_engine_contracts';
export declare class ProcessEntity extends Entity implements IProcessEntity {
    constructor(propertyBagFactory: IFactory<IPropertyBag>, encryptionService: IEncryptionService, invoker: IInvoker, entityType: IEntityType<IProcessEntity>, context: ExecutionContext, schema: IInheritedSchema);
    initialize(derivedClassInstance: IEntity): Promise<void>;
    name: string;
    key: string;
    processDef: IProcessDefEntity;
    getProcessDef(): Promise<IProcessDefEntity>;
    start(context: ExecutionContext, params: IParamStart, options?: IPublicGetOptions): Promise<void>;
}
