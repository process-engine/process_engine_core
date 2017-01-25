import { IFactory, IInheritedSchema } from '@process-engine-js/core_contracts';
import { Entity, IEntityType, IPropertyBag } from '@process-engine-js/data_model_contracts';
import { IInvoker } from '@process-engine-js/invocation_contracts';
import { ExecutionContext } from '@process-engine-js/core_contracts';
export declare class ProcessEntity extends Entity {
    static attributes: any;
    constructor(propertyBagFactory: IFactory<IPropertyBag>, invoker: IInvoker, entityType: IEntityType<ProcessEntity>, context: ExecutionContext, schema: IInheritedSchema);
}
