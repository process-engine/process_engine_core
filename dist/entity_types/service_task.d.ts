import { ExecutionContext, IFactory, IInheritedSchema, IEntity } from '@process-engine-js/core_contracts';
import { NodeInstanceEntity } from './node_instance';
import { IEntityType, IPropertyBag, IEncryptionService } from '@process-engine-js/data_model_contracts';
import { IInvoker } from '@process-engine-js/invocation_contracts';
import { IServiceTaskEntity } from '@process-engine-js/process_engine_contracts';
import { DependencyInjectionContainer } from 'addict-ioc';
export declare class ServiceTaskEntity extends NodeInstanceEntity implements IServiceTaskEntity {
    private _container;
    constructor(nodeInstanceHelper: any, container: DependencyInjectionContainer, propertyBagFactory: IFactory<IPropertyBag>, encryptionService: IEncryptionService, invoker: IInvoker, entityType: IEntityType<IServiceTaskEntity>, context: ExecutionContext, schema: IInheritedSchema);
    private readonly container;
    initialize(derivedClassInstance: IEntity): Promise<void>;
    execute(context: ExecutionContext): Promise<void>;
}
