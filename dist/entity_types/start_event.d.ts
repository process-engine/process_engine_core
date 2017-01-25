import { EventEntity } from './event';
import { IFactory, IInheritedSchema } from '@process-engine-js/core_contracts';
import { IEntityType, IPropertyBag } from '@process-engine-js/data_model_contracts';
import { IInvoker } from '@process-engine-js/invocation_contracts';
import { ExecutionContext } from '@process-engine-js/core_contracts';
export declare class StartEventEntity extends EventEntity {
    constructor(propertyBagFactory: IFactory<IPropertyBag>, invoker: IInvoker, entityType: IEntityType<StartEventEntity>, context: ExecutionContext, schema: IInheritedSchema);
}
