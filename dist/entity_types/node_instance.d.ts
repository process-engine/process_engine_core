import { Entity, IEntityType, IPropertyBag, IFactory, ISchemas } from 'data_model_contracts';
import { IInvoker } from 'invocation_contracts';
import { ExecutionContext } from 'iam_contracts';
export declare class NodeInstanceEntity extends Entity {
    static attributes: any;
    static expand: {
        attribute: string;
        depth: number;
    }[];
    constructor(propertyBagFactory: IFactory<IPropertyBag>, invoker: IInvoker, entityType: IEntityType<NodeInstanceEntity>, context: ExecutionContext, schemas: ISchemas);
}
