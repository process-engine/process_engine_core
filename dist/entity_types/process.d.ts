import { ExecutionContext, IFactory, IInheritedSchema } from '@process-engine-js/core_contracts';
import { Entity, IEntityType, IPropertyBag } from '@process-engine-js/data_model_contracts';
import { IInvoker } from '@process-engine-js/invocation_contracts';
import { IProcessEntity, IProcessDefEntity } from '@process-engine-js/process_engine_contracts';
export declare class ProcessEntity extends Entity implements IProcessEntity {
    static attributes: any;
    constructor(propertyBagFactory: IFactory<IPropertyBag>, invoker: IInvoker, entityType: IEntityType<ProcessEntity>, context: ExecutionContext, schema: IInheritedSchema);
    name: string;
    key: string;
    getProcessDef(): Promise<IProcessDefEntity>;
    setProcessDef(value: IProcessDefEntity): void;
}
