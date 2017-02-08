import { ExecutionContext, IFactory, IInheritedSchema, IEntity } from '@process-engine-js/core_contracts';
import { Entity, IEntityType, IPropertyBag } from '@process-engine-js/data_model_contracts';
import { IInvoker } from '@process-engine-js/invocation_contracts';
import { INodeInstanceEntity, INodeDefEntity, IProcessEntity, IProcessTokenEntity } from '@process-engine-js/process_engine_contracts';
export declare class NodeInstanceEntity extends Entity implements INodeInstanceEntity {
    static attributes: any;
    static expand: {
        attribute: string;
        depth: number;
    }[];
    constructor(propertyBagFactory: IFactory<IPropertyBag>, invoker: IInvoker, entityType: IEntityType<INodeInstanceEntity>, context: ExecutionContext, schema: IInheritedSchema);
    initialize(derivedClassInstance: IEntity): Promise<void>;
    name: string;
    key: string;
    getProcess(): Promise<IProcessEntity>;
    setProcess(value: IProcessEntity): void;
    getNodeDef(): Promise<INodeDefEntity>;
    setNodeDef(value: INodeDefEntity): void;
    type: string;
    state: string;
    participant: string;
    getProcessToken(): Promise<IProcessTokenEntity>;
    setProcessToken(value: IProcessTokenEntity): void;
}
