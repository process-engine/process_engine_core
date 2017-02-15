import { ExecutionContext, IFactory, IInheritedSchema, IEntity } from '@process-engine-js/core_contracts';
import { Entity, IEntityType, IPropertyBag, IEncryptionService } from '@process-engine-js/data_model_contracts';
import { IInvoker } from '@process-engine-js/invocation_contracts';
import { INodeInstanceEntity, INodeDefEntity, IProcessEntity, IProcessTokenEntity } from '@process-engine-js/process_engine_contracts';
export declare class NodeInstanceEntity extends Entity implements INodeInstanceEntity {
    constructor(propertyBagFactory: IFactory<IPropertyBag>, encryptionService: IEncryptionService, invoker: IInvoker, entityType: IEntityType<INodeInstanceEntity>, context: ExecutionContext, schema: IInheritedSchema);
    initialize(derivedClassInstance: IEntity): Promise<void>;
    name: string;
    key: string;
    process: IProcessEntity;
    getProcess(): Promise<IProcessEntity>;
    nodeDef: INodeDefEntity;
    getNodeDef(): Promise<INodeDefEntity>;
    type: string;
    state: string;
    participant: string;
    processToken: IProcessTokenEntity;
    getProcessToken(): Promise<IProcessTokenEntity>;
}
