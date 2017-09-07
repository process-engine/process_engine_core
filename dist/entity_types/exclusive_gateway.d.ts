import { NodeInstanceEntity } from './node_instance';
import { EntityDependencyHelper, IPropertyBag } from '@process-engine-js/data_model_contracts';
import { ExecutionContext, IInheritedSchema } from '@process-engine-js/core_contracts';
import { IExclusiveGatewayEntity } from '@process-engine-js/process_engine_contracts';
import { NodeInstanceEntityDependencyHelper } from './node_instance';
export declare class ExclusiveGatewayEntity extends NodeInstanceEntity implements IExclusiveGatewayEntity {
    constructor(nodeInstanceEntityDependencyHelper: NodeInstanceEntityDependencyHelper, entityDependencyHelper: EntityDependencyHelper, context: ExecutionContext, schema: IInheritedSchema, propertyBag: IPropertyBag);
    initialize(): Promise<void>;
    follow: any;
    execute(context: ExecutionContext): Promise<void>;
}
