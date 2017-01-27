import { NodeInstanceEntity } from './node_instance';
import { ExecutionContext, IFactory, IInheritedSchema, IEntity } from '@process-engine-js/core_contracts';
import { IEntityType, IPropertyBag } from '@process-engine-js/data_model_contracts';
import { IInvoker } from '@process-engine-js/invocation_contracts';
import { IExclusiveGatewayEntity } from '@process-engine-js/process_engine_contracts';
export declare class ExclusiveGatewayEntity extends NodeInstanceEntity implements IExclusiveGatewayEntity {
    static attributes: any;
    constructor(propertyBagFactory: IFactory<IPropertyBag>, invoker: IInvoker, entityType: IEntityType<ExclusiveGatewayEntity>, context: ExecutionContext, schema: IInheritedSchema);
    initialize(derivedClassInstance: IEntity): void;
    follow: any;
}
