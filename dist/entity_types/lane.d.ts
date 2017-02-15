import { ExecutionContext, IFactory, IInheritedSchema, IEntity } from '@process-engine-js/core_contracts';
import { Entity, IEntityType, IPropertyBag, IEncryptionService } from '@process-engine-js/data_model_contracts';
import { IInvoker } from '@process-engine-js/invocation_contracts';
import { ILaneEntity, IProcessDefEntity } from '@process-engine-js/process_engine_contracts';
export declare class LaneEntity extends Entity implements ILaneEntity {
    constructor(propertyBagFactory: IFactory<IPropertyBag>, encryptionService: IEncryptionService, invoker: IInvoker, entityType: IEntityType<ILaneEntity>, context: ExecutionContext, schema: IInheritedSchema);
    initialize(derivedClassInstance: IEntity): Promise<void>;
    name: string;
    key: string;
    extensions: any;
    processDef: any;
    getProcessDef(): Promise<IProcessDefEntity>;
}
