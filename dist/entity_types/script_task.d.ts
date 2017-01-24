import { NodeInstanceEntity } from './node_instance';
import { IEntityType, IPropertyBag, IFactory, ISchemas } from 'data_model_contracts';
import { IInvoker } from 'invocation_contracts';
import { ExecutionContext } from 'iam_contracts';
export declare class ScriptTaskEntity extends NodeInstanceEntity {
    static attributes: any;
    constructor(propertyBagFactory: IFactory<IPropertyBag>, invoker: IInvoker, entityType: IEntityType<ScriptTaskEntity>, context: ExecutionContext, schemas: ISchemas);
}
