import { ExecutionContext, IFactory, IInheritedSchema, IEntity } from '@process-engine-js/core_contracts';
import { Entity, IEntityType, IPropertyBag } from '@process-engine-js/data_model_contracts';
import { IInvoker } from '@process-engine-js/invocation_contracts';
import { INodeDefEntity, IProcessDefEntity, ILaneEntity } from '@process-engine-js/process_engine_contracts';
export declare class NodeDefEntity extends Entity implements INodeDefEntity {
    static attributes: any;
    constructor(propertyBagFactory: IFactory<IPropertyBag>, invoker: IInvoker, entityType: IEntityType<NodeDefEntity>, context: ExecutionContext, schema: IInheritedSchema);
    initialize(derivedClassInstance: IEntity): void;
    name: string;
    key: string;
    getProcessDef(): Promise<IProcessDefEntity>;
    setProcessDef(value: IProcessDefEntity): void;
    getLane(): Promise<ILaneEntity>;
    setLane(value: ILaneEntity): void;
    type: string;
    extensions: any;
    getAttachedToNode(): Promise<INodeDefEntity>;
    setAttachedToNode(value: INodeDefEntity): void;
    events: string;
    getLaneRole(context: ExecutionContext): Promise<string>;
}
