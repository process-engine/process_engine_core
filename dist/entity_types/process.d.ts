import { ExecutionContext, IFactory, IInheritedSchema, IEntity, IPublicGetOptions } from '@process-engine-js/core_contracts';
import { Entity, IEntityType, IPropertyBag, IEncryptionService, IDatastoreService } from '@process-engine-js/data_model_contracts';
import { IInvoker } from '@process-engine-js/invocation_contracts';
import { IProcessEntity, IProcessDefEntity, IParamStart, INodeInstanceEntityTypeService } from '@process-engine-js/process_engine_contracts';
import { IIamService } from '@process-engine-js/iam_contracts';
export declare class ProcessEntity extends Entity implements IProcessEntity {
    private _datastoreService;
    private _iamService;
    private _nodeInstanceEntityTypeService;
    constructor(datastoreService: IDatastoreService, iamService: IIamService, nodeInstanceEntityTypeService: INodeInstanceEntityTypeService, propertyBagFactory: IFactory<IPropertyBag>, encryptionService: IEncryptionService, invoker: IInvoker, entityType: IEntityType<IProcessEntity>, context: ExecutionContext, schema: IInheritedSchema);
    private readonly datastoreService;
    private readonly iamService;
    private readonly nodeInstanceEntityTypeService;
    initialize(derivedClassInstance: IEntity): Promise<void>;
    name: string;
    key: string;
    processDef: IProcessDefEntity;
    getProcessDef(): Promise<IProcessDefEntity>;
    start(context: ExecutionContext, params: IParamStart, options?: IPublicGetOptions): Promise<void>;
}
