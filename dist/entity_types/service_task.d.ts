import { ExecutionContext, IFactory, IInheritedSchema, IEntity } from '@process-engine-js/core_contracts';
import { NodeInstanceEntity } from './node_instance';
import { IEntityType, IPropertyBag } from '@process-engine-js/data_model_contracts';
import { IInvoker } from '@process-engine-js/invocation_contracts';
import { IServiceTaskEntity } from '@process-engine-js/process_engine_contracts';
export declare class ServiceTaskEntity extends NodeInstanceEntity implements IServiceTaskEntity {
    constructor(propertyBagFactory: IFactory<IPropertyBag>, invoker: IInvoker, entityType: IEntityType<IServiceTaskEntity>, context: ExecutionContext, schema: IInheritedSchema);
    initialize(derivedClassInstance: IEntity): Promise<void>;
}
