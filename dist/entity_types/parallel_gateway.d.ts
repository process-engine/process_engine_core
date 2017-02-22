import { ExecutionContext, IFactory, IInheritedSchema, IEntity, IEntityReference } from '@process-engine-js/core_contracts';
import { NodeInstanceEntity } from './node_instance';
import { IEntityType, IPropertyBag, IEncryptionService } from '@process-engine-js/data_model_contracts';
import { IInvoker } from '@process-engine-js/invocation_contracts';
import { IParallelGatewayEntity } from '@process-engine-js/process_engine_contracts';
export declare class ParallelGatewayEntity extends NodeInstanceEntity implements IParallelGatewayEntity {
    constructor(nodeInstanceHelper: any, propertyBagFactory: IFactory<IPropertyBag>, encryptionService: IEncryptionService, invoker: IInvoker, entityType: IEntityType<IParallelGatewayEntity>, context: ExecutionContext, schema: IInheritedSchema);
    initialize(derivedClassInstance: IEntity): Promise<void>;
    parallelType: string;
    execute(context: ExecutionContext): Promise<void>;
    proceed(context: ExecutionContext, newData: any, source: IEntityReference): Promise<void>;
}
