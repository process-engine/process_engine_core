import { ExecutionContext, IEntity, IInheritedSchema } from '@process-engine-js/core_contracts';
import { NodeInstanceEntity, NodeInstanceEntityDependencyHelper } from './node_instance';
import { EntityDependencyHelper, IEntityType, IPropertyBag } from '@process-engine-js/data_model_contracts';
import { IScriptTaskEntity } from '@process-engine-js/process_engine_contracts';
export declare class ScriptTaskEntity extends NodeInstanceEntity implements IScriptTaskEntity {
    constructor(nodeInstanceEntityDependencyHelper: NodeInstanceEntityDependencyHelper, entityDependencyHelper: EntityDependencyHelper, context: ExecutionContext, schema: IInheritedSchema, propertyBag: IPropertyBag, entityType: IEntityType<IEntity>);
    initialize(): Promise<void>;
    script: string;
    execute(context: any): Promise<void>;
}
