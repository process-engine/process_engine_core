import { ExecutionContext, IEntity, IInheritedSchema } from '@process-engine-js/core_contracts';
import { Entity, EntityDependencyHelper, IEntityType, IPropertyBag } from '@process-engine-js/data_model_contracts';
import { IFlowDefEntity, IProcessDefEntity, INodeDefEntity } from '@process-engine-js/process_engine_contracts';
export declare class FlowDefEntity extends Entity implements IFlowDefEntity {
    constructor(entityDependencyHelper: EntityDependencyHelper, context: ExecutionContext, schema: IInheritedSchema, propertyBag: IPropertyBag, entityType: IEntityType<IEntity>);
    initialize(): Promise<void>;
    name: string;
    key: string;
    processDef: IProcessDefEntity;
    getProcessDef(context: ExecutionContext): Promise<IProcessDefEntity>;
    source: INodeDefEntity;
    getSource(context: ExecutionContext): Promise<INodeDefEntity>;
    target: INodeDefEntity;
    getTarget(context: ExecutionContext): Promise<INodeDefEntity>;
    condition: string;
    extensions: any;
    counter: number;
    readonly mapper: any;
    private _extractMapper();
}
