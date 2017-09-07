import { EventEntity } from './event';
import { EntityDependencyHelper, IPropertyBag } from '@process-engine-js/data_model_contracts';
import { ExecutionContext, IInheritedSchema } from '@process-engine-js/core_contracts';
import { IEndEventEntity } from '@process-engine-js/process_engine_contracts';
import { NodeInstanceEntityDependencyHelper } from './node_instance';
export declare class EndEventEntity extends EventEntity implements IEndEventEntity {
    constructor(nodeInstanceEntityDependencyHelper: NodeInstanceEntityDependencyHelper, entityDependencyHelper: EntityDependencyHelper, context: ExecutionContext, schema: IInheritedSchema, propertyBag: IPropertyBag);
    initialize(): Promise<void>;
    execute(context: ExecutionContext): Promise<void>;
}
