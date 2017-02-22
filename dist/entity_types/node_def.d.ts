import { ExecutionContext, IFactory, IInheritedSchema, IEntity } from '@process-engine-js/core_contracts';
import { Entity, IEntityType, IPropertyBag, IEncryptionService, IDatastoreService, EntityCollection } from '@process-engine-js/data_model_contracts';
import { IInvoker } from '@process-engine-js/invocation_contracts';
import { INodeDefEntity, IProcessDefEntity, ILaneEntity } from '@process-engine-js/process_engine_contracts';
export declare class NodeDefEntity extends Entity implements INodeDefEntity {
    private _datastoreService;
    constructor(datastoreService: IDatastoreService, propertyBagFactory: IFactory<IPropertyBag>, encryptionService: IEncryptionService, invoker: IInvoker, entityType: IEntityType<INodeDefEntity>, context: ExecutionContext, schema: IInheritedSchema);
    private readonly datastoreService;
    initialize(derivedClassInstance: IEntity): Promise<void>;
    name: string;
    key: string;
    processDef: IProcessDefEntity;
    getProcessDef(): Promise<IProcessDefEntity>;
    lane: ILaneEntity;
    getLane(): Promise<ILaneEntity>;
    type: string;
    extensions: any;
    attachedToNode: INodeDefEntity;
    getAttachedToNode(): Promise<INodeDefEntity>;
    events: any;
    script: string;
    eventType: string;
    cancelActivity: boolean;
    subProcessKey: string;
    subProcessDef: INodeDefEntity;
    getSubProcessDef(): Promise<INodeDefEntity>;
    getLaneRole(context: ExecutionContext): Promise<string>;
    getBoundaryEvents(context: ExecutionContext): Promise<EntityCollection>;
}
