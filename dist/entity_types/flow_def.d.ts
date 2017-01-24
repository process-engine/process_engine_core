import { Entity, IEntityType, IPropertyBag, IFactory, ISchemas } from 'data_model_contracts';
import { IInvoker } from 'invocation_contracts';
import { ExecutionContext } from 'iam_contracts';
export declare class FlowDefEntity extends Entity {
    static attributes: any;
    constructor(propertyBagFactory: IFactory<IPropertyBag>, invoker: IInvoker, entityType: IEntityType<FlowDefEntity>, context: ExecutionContext, schemas: ISchemas);
}
