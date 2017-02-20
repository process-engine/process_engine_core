import { NodeInstanceEntity } from './node_instance';
import { ExecutionContext, IFactory, IInheritedSchema, IEntity } from '@process-engine-js/core_contracts';
import { IEntityType, IPropertyBag, IEncryptionService } from '@process-engine-js/data_model_contracts';
import { IInvoker } from '@process-engine-js/invocation_contracts';
import { IExclusiveGatewayEntity } from '@process-engine-js/process_engine_contracts';
export declare class ExclusiveGatewayEntity extends NodeInstanceEntity implements IExclusiveGatewayEntity {
    constructor(nodeInstanceHelper: any, propertyBagFactory: IFactory<IPropertyBag>, encryptionService: IEncryptionService, invoker: IInvoker, entityType: IEntityType<IExclusiveGatewayEntity>, context: ExecutionContext, schema: IInheritedSchema);
    initialize(derivedClassInstance: IEntity): Promise<void>;
    follow: any;
}
