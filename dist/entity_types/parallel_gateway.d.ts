import { ExecutionContext, IEntity, IEntityReference, IInheritedSchema } from '@process-engine-js/core_contracts';
import { EntityDependencyHelper } from '@process-engine-js/data_model_contracts';
import { NodeInstanceEntity, NodeInstanceEntityDependencyHelper } from './node_instance';
import { IParallelGatewayEntity } from '@process-engine-js/process_engine_contracts';
export declare class ParallelGatewayEntity extends NodeInstanceEntity implements IParallelGatewayEntity {
    constructor(nodeInstanceEntityDependencyHelper: NodeInstanceEntityDependencyHelper, entityDependencyHelper: EntityDependencyHelper, context: ExecutionContext, schema: IInheritedSchema);
    initialize(derivedClassInstance: IEntity): Promise<void>;
    parallelType: string;
    execute(context: ExecutionContext): Promise<void>;
    proceed(context: ExecutionContext, newData: any, source: IEntityReference, applicationId: string): Promise<void>;
}
