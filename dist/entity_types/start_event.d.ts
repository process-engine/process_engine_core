import { EventEntity } from './event';
import { IEntityType, IPropertyBag, IFactory, ISchemas } from 'data_model_contracts';
import { IInvoker } from 'invocation_contracts';
import { ExecutionContext } from 'iam_contracts';
export declare class StartEventEntity extends EventEntity {
    constructor(propertyBagFactory: IFactory<IPropertyBag>, invoker: IInvoker, entityType: IEntityType<StartEventEntity>, context: ExecutionContext, schemas: ISchemas);
}
