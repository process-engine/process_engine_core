import { EventEntity } from './event';
import { IEntityType, IPropertyBag, IFactory, ISchemas } from 'data_model_contracts';
import { IInvoker } from 'invocation_contracts';
import { ExecutionContext } from 'iam_contracts';
export declare class EndEventEntity extends EventEntity {
    constructor(propertyBagFactory: IFactory<IPropertyBag>, invoker: IInvoker, entityType: IEntityType<EndEventEntity>, context: ExecutionContext, schemas: ISchemas);
}
