import { ExecutionContext, IEntity, IInheritedSchema } from '@process-engine-js/core_contracts';
import { Entity, EntityDependencyHelper } from '@process-engine-js/data_model_contracts';
import { ILaneEntity, IProcessDefEntity } from '@process-engine-js/process_engine_contracts';
export declare class LaneEntity extends Entity implements ILaneEntity {
    constructor(entityDependencyHelper: EntityDependencyHelper, context: ExecutionContext, schema: IInheritedSchema);
    initialize(derivedClassInstance: IEntity): Promise<void>;
    name: string;
    key: string;
    extensions: any;
    processDef: any;
    getProcessDef(): Promise<IProcessDefEntity>;
}
