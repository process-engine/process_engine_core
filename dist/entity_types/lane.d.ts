import { Entity, IEntityType, IPropertyBag, IFactory, ISchemas } from 'data_model_contracts';
import { IInvoker } from 'invocation_contracts';
import { ExecutionContext } from 'iam_contracts';
export declare class LaneEntity extends Entity {
    static attributes: any;
    static datasources: string[];
    constructor(propertyBagFactory: IFactory<IPropertyBag>, invoker: IInvoker, entityType: IEntityType<LaneEntity>, context: ExecutionContext, schemas: ISchemas);
}
