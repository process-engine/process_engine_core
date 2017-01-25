import { NodeInstanceEntity } from './node_instance';
import { IFactory, IInheritedSchema } from '@process-engine-js/core_contracts';
import { IEntityType, IPropertyBag } from '@process-engine-js/data_model_contracts';
import { IInvoker } from '@process-engine-js/invocation_contracts';
import { ExecutionContext } from '@process-engine-js/core_contracts';
export declare class ExclusiveGatewayEntity extends NodeInstanceEntity {
    static attributes: any;
    constructor(propertyBagFactory: IFactory<IPropertyBag>, invoker: IInvoker, entityType: IEntityType<ExclusiveGatewayEntity>, context: ExecutionContext, schema: IInheritedSchema);
}
