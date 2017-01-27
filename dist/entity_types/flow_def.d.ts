import { ExecutionContext, IFactory, IInheritedSchema } from '@process-engine-js/core_contracts';
import { Entity, IEntityType, IPropertyBag } from '@process-engine-js/data_model_contracts';
import { IInvoker } from '@process-engine-js/invocation_contracts';
import { IFlowDefEntity, IProcessDefEntity, INodeDefEntity } from '@process-engine-js/process_engine_contracts';
export declare class FlowDefEntity extends Entity implements IFlowDefEntity {
    static attributes: any;
    constructor(propertyBagFactory: IFactory<IPropertyBag>, invoker: IInvoker, entityType: IEntityType<FlowDefEntity>, context: ExecutionContext, schema: IInheritedSchema);
    name: string;
    key: string;
    getProcessDef(): Promise<IProcessDefEntity>;
    setProcessDef(value: IProcessDefEntity): void;
    getSource(): Promise<INodeDefEntity>;
    setSource(value: INodeDefEntity): void;
    getTarget(): Promise<INodeDefEntity>;
    setTarget(value: INodeDefEntity): void;
    condition: string;
}
