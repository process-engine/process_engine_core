import { ExecutionContext, IEntity, IPublicGetOptions, IInheritedSchema, IIamService } from '@process-engine-js/core_contracts';
import { Entity, EntityDependencyHelper } from '@process-engine-js/data_model_contracts';
import { IProcessEntity, IProcessDefEntity, IParamStart, INodeInstanceEntityTypeService } from '@process-engine-js/process_engine_contracts';
import { IMessageBusService } from '@process-engine-js/messagebus_contracts';
export declare class ProcessEntity extends Entity implements IProcessEntity {
    private _iamService;
    private _nodeInstanceEntityTypeService;
    private _messageBusService;
    private _activeInstances;
    constructor(iamService: IIamService, nodeInstanceEntityTypeService: INodeInstanceEntityTypeService, messageBusService: IMessageBusService, entityDependencyHelper: EntityDependencyHelper, context: ExecutionContext, schema: IInheritedSchema);
    private readonly iamService;
    private readonly nodeInstanceEntityTypeService;
    private readonly messageBusService;
    initialize(derivedClassInstance: IEntity): Promise<void>;
    readonly activeInstances: any;
    name: string;
    key: string;
    processDef: IProcessDefEntity;
    getProcessDef(context: ExecutionContext): Promise<IProcessDefEntity>;
    isSubProcess: boolean;
    callerId: string;
    start(context: ExecutionContext, params: IParamStart, options?: IPublicGetOptions): Promise<void>;
    end(context: ExecutionContext, processToken: any): Promise<void>;
    error(context: ExecutionContext, error: any): Promise<void>;
    addActiveInstance(entity: IEntity): void;
    removeActiveInstance(entity: IEntity): void;
}
