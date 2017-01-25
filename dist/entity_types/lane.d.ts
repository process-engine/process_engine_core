import { IFactory, IInheritedSchema } from '@process-engine-js/core_contracts';
import { Entity, IEntityType, IPropertyBag } from '@process-engine-js/data_model_contracts';
import { IInvoker } from '@process-engine-js/invocation_contracts';
import { ExecutionContext } from '@process-engine-js/core_contracts';
export declare class LaneEntity extends Entity {
    static attributes: any;
    static datasources: string[];
    constructor(propertyBagFactory: IFactory<IPropertyBag>, invoker: IInvoker, entityType: IEntityType<LaneEntity>, context: ExecutionContext, schema: IInheritedSchema);
}
