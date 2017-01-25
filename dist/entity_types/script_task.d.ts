import { NodeInstanceEntity } from './node_instance';
import { IFactory, IInheritedSchema } from '@process-engine-js/core_contracts';
import { IEntityType, IPropertyBag } from '@process-engine-js/data_model_contracts';
import { IInvoker } from '@process-engine-js/invocation_contracts';
import { ExecutionContext } from '@process-engine-js/core_contracts';
export declare class ScriptTaskEntity extends NodeInstanceEntity {
    static attributes: any;
    constructor(propertyBagFactory: IFactory<IPropertyBag>, invoker: IInvoker, entityType: IEntityType<ScriptTaskEntity>, context: ExecutionContext, schema: IInheritedSchema);
}
