import { ExecutionContext, IFactory, IInheritedSchema, IEntity } from '@process-engine-js/core_contracts';
import { NodeInstanceEntity } from './node_instance';
import { IEntityType, IPropertyBag, IEncryptionService } from '@process-engine-js/data_model_contracts';
import { IInvoker } from '@process-engine-js/invocation_contracts';
import { IScriptTaskEntity } from '@process-engine-js/process_engine_contracts';
export declare class ScriptTaskEntity extends NodeInstanceEntity implements IScriptTaskEntity {
    constructor(nodeInstanceHelper: any, propertyBagFactory: IFactory<IPropertyBag>, encryptionService: IEncryptionService, invoker: IInvoker, entityType: IEntityType<IScriptTaskEntity>, context: ExecutionContext, schema: IInheritedSchema);
    initialize(derivedClassInstance: IEntity): Promise<void>;
    script: string;
    execute(context: any): Promise<void>;
}
