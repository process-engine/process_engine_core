import { ExecutionContext, IEntity, IInheritedSchema } from '@process-engine-js/core_contracts';
import { NodeInstanceEntity, NodeInstanceEntityDependencyHelper } from './node_instance';
import { EntityDependencyHelper, IEntityType, IPropertyBag } from '@process-engine-js/data_model_contracts';
import { IServiceTaskEntity } from '@process-engine-js/process_engine_contracts';
import { Container, IInstanceWrapper } from 'addict-ioc';
export declare class ServiceTaskEntity extends NodeInstanceEntity implements IServiceTaskEntity {
    private _container;
    constructor(container: Container<IInstanceWrapper<any>>, nodeInstanceEntityDependencyHelper: NodeInstanceEntityDependencyHelper, entityDependencyHelper: EntityDependencyHelper, context: ExecutionContext, schema: IInheritedSchema, propertyBag: IPropertyBag, entityType: IEntityType<IEntity>);
    private readonly container;
    initialize(): Promise<void>;
    execute(context: ExecutionContext): Promise<void>;
}
