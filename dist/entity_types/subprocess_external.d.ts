import { NodeInstanceEntity, NodeInstanceEntityDependencyHelper } from './node_instance';
import { EntityDependencyHelper } from '@process-engine-js/data_model_contracts';
import { ExecutionContext, IEntity, IInheritedSchema } from '@process-engine-js/core_contracts';
import { ISubprocessExternalEntity, IProcessDefEntityTypeService } from '@process-engine-js/process_engine_contracts';
export declare class SubprocessExternalEntity extends NodeInstanceEntity implements ISubprocessExternalEntity {
    private _processDefEntityTypeService;
    constructor(nodeInstanceEntityDependencyHelper: NodeInstanceEntityDependencyHelper, processDefEntityTypeService: IProcessDefEntityTypeService, entityDependencyHelper: EntityDependencyHelper, context: ExecutionContext, schema: IInheritedSchema);
    private readonly processDefEntityTypeService;
    initialize(derivedClassInstance: IEntity): Promise<void>;
    execute(context: ExecutionContext): Promise<void>;
    proceed(context: ExecutionContext, newData: any, source: IEntity, applicationId: string, participant: string): Promise<void>;
}
