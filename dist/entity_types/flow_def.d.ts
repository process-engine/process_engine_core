import { ExecutionContext, IEntity, IInheritedSchema } from '@process-engine-js/core_contracts';
import { Entity, EntityDependencyHelper } from '@process-engine-js/data_model_contracts';
import { IFlowDefEntity, IProcessDefEntity, INodeDefEntity } from '@process-engine-js/process_engine_contracts';
export declare class FlowDefEntity extends Entity implements IFlowDefEntity {
    constructor(entityDependencyHelper: EntityDependencyHelper, context: ExecutionContext, schema: IInheritedSchema);
    initialize(derivedClassInstance: IEntity): Promise<void>;
    name: string;
    key: string;
    processDef: IProcessDefEntity;
    getProcessDef(): Promise<IProcessDefEntity>;
    source: INodeDefEntity;
    getSource(): Promise<INodeDefEntity>;
    target: INodeDefEntity;
    getTarget(): Promise<INodeDefEntity>;
    condition: string;
}
