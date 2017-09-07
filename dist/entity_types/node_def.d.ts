import { ExecutionContext, IInheritedSchema } from '@process-engine-js/core_contracts';
import { Entity, EntityDependencyHelper, EntityCollection, IPropertyBag } from '@process-engine-js/data_model_contracts';
import { TimerDefinitionType, INodeDefEntity, IProcessDefEntity, ILaneEntity } from '@process-engine-js/process_engine_contracts';
import { IFeature } from '@process-engine-js/feature_contracts';
export declare class NodeDefEntity extends Entity implements INodeDefEntity {
    constructor(entityDependencyHelper: EntityDependencyHelper, context: ExecutionContext, schema: IInheritedSchema, propertyBag: IPropertyBag);
    initialize(): Promise<void>;
    name: string;
    key: string;
    processDef: IProcessDefEntity;
    getProcessDef(context: ExecutionContext): Promise<IProcessDefEntity>;
    lane: ILaneEntity;
    getLane(context: ExecutionContext): Promise<ILaneEntity>;
    type: string;
    extensions: any;
    attachedToNode: INodeDefEntity;
    getAttachedToNode(context: ExecutionContext): Promise<INodeDefEntity>;
    events: any;
    script: string;
    eventType: string;
    cancelActivity: boolean;
    subProcessKey: string;
    subProcessDef: INodeDefEntity;
    getSubProcessDef(context: ExecutionContext): Promise<INodeDefEntity>;
    counter: number;
    timerDefinitionType: TimerDefinitionType;
    timerDefinition: string;
    startContext: string;
    startContextEntityType: string;
    signal: string;
    message: string;
    condition: string;
    errorName: string;
    errorCode: string;
    readonly features: Array<IFeature>;
    getLaneRole(context: ExecutionContext): Promise<string>;
    getBoundaryEvents(context: ExecutionContext): Promise<EntityCollection>;
    private _extractFeatures();
    readonly mapper: any;
    private _extractMapper();
    readonly persist: boolean;
}
