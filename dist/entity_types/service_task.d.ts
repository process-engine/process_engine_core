import { ExecutionContext, IEntity } from '@process-engine-js/core_contracts';
import { NodeInstanceEntity, NodeInstanceEntityDependencyHelper } from './node_instance';
import { EntityDependencyHelper } from '@process-engine-js/data_model_contracts';
import { IServiceTaskEntity } from '@process-engine-js/process_engine_contracts';
import { DependencyInjectionContainer } from 'addict-ioc';
export declare class ServiceTaskEntity extends NodeInstanceEntity implements IServiceTaskEntity {
    private _container;
    constructor(container: DependencyInjectionContainer, nodeInstanceEntityDependencyHelper: NodeInstanceEntityDependencyHelper, entityDependencyHelper: EntityDependencyHelper);
    private readonly container;
    initialize(derivedClassInstance: IEntity): Promise<void>;
    execute(context: ExecutionContext): Promise<void>;
}
