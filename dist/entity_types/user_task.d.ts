import { NodeInstanceEntity } from './node_instance';
import { IFactory, IInheritedSchema } from '@process-engine-js/core_contracts';
import { IEntityType, IPropertyBag } from '@process-engine-js/data_model_contracts';
import { IInvoker } from '@process-engine-js/invocation_contracts';
import { ExecutionContext } from '@process-engine-js/core_contracts';
export declare class UserTaskEntity extends NodeInstanceEntity {
    constructor(propertyBagFactory: IFactory<IPropertyBag>, invoker: IInvoker, entityType: IEntityType<UserTaskEntity>, context: ExecutionContext, schema: IInheritedSchema);
}
