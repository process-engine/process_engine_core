import { ExecutionContext, IEntity, IPublicGetOptions, IInheritedSchema, IIamService } from '@process-engine-js/core_contracts';
import { Entity, EntityDependencyHelper } from '@process-engine-js/data_model_contracts';
import { IProcessEntity, IProcessDefEntity, IParamStart, INodeInstanceEntityTypeService } from '@process-engine-js/process_engine_contracts';
export declare class ProcessEntity extends Entity implements IProcessEntity {
    private _iamService;
    private _nodeInstanceEntityTypeService;
    constructor(iamService: IIamService, nodeInstanceEntityTypeService: INodeInstanceEntityTypeService, entityDependencyHelper: EntityDependencyHelper, context: ExecutionContext, schema: IInheritedSchema);
    private readonly iamService;
    private readonly nodeInstanceEntityTypeService;
    initialize(derivedClassInstance: IEntity): Promise<void>;
    name: string;
    key: string;
    processDef: IProcessDefEntity;
    getProcessDef(context: ExecutionContext): Promise<IProcessDefEntity>;
    start(context: ExecutionContext, params: IParamStart, options?: IPublicGetOptions): Promise<void>;
}
