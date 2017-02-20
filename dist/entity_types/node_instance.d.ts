import { ExecutionContext, IFactory, IInheritedSchema, IEntity } from '@process-engine-js/core_contracts';
import { Entity, IEntityType, IPropertyBag, IEncryptionService } from '@process-engine-js/data_model_contracts';
import { IInvoker } from '@process-engine-js/invocation_contracts';
import { INodeInstanceEntity, INodeDefEntity, IProcessEntity, IProcessTokenEntity } from '@process-engine-js/process_engine_contracts';
export declare class NodeInstanceEntity extends Entity implements INodeInstanceEntity {
    private _helper;
    constructor(nodeInstanceHelper: any, propertyBagFactory: IFactory<IPropertyBag>, encryptionService: IEncryptionService, invoker: IInvoker, entityType: IEntityType<INodeInstanceEntity>, context: ExecutionContext, schema: IInheritedSchema);
    private readonly helper;
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
    createNode(context: any): Promise<any>;
    getLaneRole(context: ExecutionContext): Promise<string>;
    start(context: ExecutionContext, source: any): Promise<void>;
    changeState(context: ExecutionContext, newState: string, source: any): Promise<void>;
}
