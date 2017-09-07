import { EventEntity } from './event';
import { EntityDependencyHelper, IPropertyBag } from '@process-engine-js/data_model_contracts';
import { ExecutionContext, IInheritedSchema } from '@process-engine-js/core_contracts';
import { IBoundaryEventEntity, INodeInstanceEntity } from '@process-engine-js/process_engine_contracts';
import { NodeInstanceEntityDependencyHelper } from './node_instance';
export declare class BoundaryEventEntity extends EventEntity implements IBoundaryEventEntity {
    attachedToInstance: INodeInstanceEntity;
    constructor(nodeInstanceEntityDependencyHelper: NodeInstanceEntityDependencyHelper, entityDependencyHelper: EntityDependencyHelper, context: ExecutionContext, schema: IInheritedSchema, propertyBag: IPropertyBag);
    initialize(): Promise<void>;
    execute(context: ExecutionContext): Promise<void>;
    proceed(context: ExecutionContext, data: any, source: INodeInstanceEntity, applicationId: string, participant: string): Promise<void>;
}
