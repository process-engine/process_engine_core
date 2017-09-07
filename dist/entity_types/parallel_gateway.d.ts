import { ExecutionContext, IEntity, IInheritedSchema } from '@process-engine-js/core_contracts';
import { EntityDependencyHelper, IPropertyBag } from '@process-engine-js/data_model_contracts';
import { NodeInstanceEntity, NodeInstanceEntityDependencyHelper } from './node_instance';
import { IParallelGatewayEntity } from '@process-engine-js/process_engine_contracts';
export declare class ParallelGatewayEntity extends NodeInstanceEntity implements IParallelGatewayEntity {
    constructor(nodeInstanceEntityDependencyHelper: NodeInstanceEntityDependencyHelper, entityDependencyHelper: EntityDependencyHelper, context: ExecutionContext, schema: IInheritedSchema, propertyBag: IPropertyBag);
    initialize(): Promise<void>;
    parallelType: string;
    execute(context: ExecutionContext): Promise<void>;
    proceed(context: ExecutionContext, newData: any, source: IEntity, applicationId: string, participant: string): Promise<void>;
}
