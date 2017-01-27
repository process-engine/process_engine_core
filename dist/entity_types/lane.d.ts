import { ExecutionContext, IFactory, IInheritedSchema, IEntity } from '@process-engine-js/core_contracts';
import { Entity, IEntityType, IPropertyBag } from '@process-engine-js/data_model_contracts';
import { IInvoker } from '@process-engine-js/invocation_contracts';
import { ILaneEntity, IProcessDefEntity } from '@process-engine-js/process_engine_contracts';
export declare class LaneEntity extends Entity implements ILaneEntity {
    static attributes: any;
    static datasources: string[];
    constructor(propertyBagFactory: IFactory<IPropertyBag>, invoker: IInvoker, entityType: IEntityType<LaneEntity>, context: ExecutionContext, schema: IInheritedSchema);
    initialize(derivedClassInstance: IEntity): void;
    name: string;
    key: string;
    extensions: any;
    getProcessDef(): Promise<IProcessDefEntity>;
    setProcessDef(value: IProcessDefEntity): void;
}
