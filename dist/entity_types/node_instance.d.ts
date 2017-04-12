import { ExecutionContext, IInheritedSchema, IEntity, IIamService, IEntityReference } from '@process-engine-js/core_contracts';
import { Entity, EntityDependencyHelper } from '@process-engine-js/data_model_contracts';
import { INodeInstanceEntity, INodeInstanceEntityTypeService, INodeDefEntity, IProcessEntity, IProcessTokenEntity, IProcessEngineService } from '@process-engine-js/process_engine_contracts';
import { IMessageBusService } from '@process-engine-js/messagebus_contracts';
import { IEventAggregator } from '@process-engine-js/event_aggregator_contracts';
export declare class NodeInstanceEntityDependencyHelper {
    messageBusService: IMessageBusService;
    eventAggregator: IEventAggregator;
    iamService: IIamService;
    nodeInstanceEntityTypeService: INodeInstanceEntityTypeService;
    processEngineService: IProcessEngineService;
    constructor(messageBusService: IMessageBusService, eventAggregator: IEventAggregator, iamService: IIamService, nodeInstanceEntityTypeService: INodeInstanceEntityTypeService, processEngineService: IProcessEngineService);
}
export declare class NodeInstanceEntity extends Entity implements INodeInstanceEntity {
    private _nodeInstanceEntityDependencyHelper;
    messagebusSubscription: any;
    eventAggregatorSubscription: any;
    constructor(nodeInstanceEntityDependencyHelper: NodeInstanceEntityDependencyHelper, entityDependencyHelper: EntityDependencyHelper, context: ExecutionContext, schema: IInheritedSchema);
    protected readonly iamService: IIamService;
    protected readonly messageBusService: IMessageBusService;
    protected readonly eventAggregator: IEventAggregator;
    protected readonly nodeInstanceEntityTypeService: INodeInstanceEntityTypeService;
    protected readonly processEngineService: IProcessEngineService;
    initialize(derivedClassInstance: IEntity): Promise<void>;
    name: string;
    key: string;
    process: IProcessEntity;
    getProcess(context: ExecutionContext): Promise<IProcessEntity>;
    nodeDef: INodeDefEntity;
    getNodeDef(context: ExecutionContext): Promise<INodeDefEntity>;
    type: string;
    state: string;
    participant: string;
    processToken: IProcessTokenEntity;
    getProcessToken(context: ExecutionContext): Promise<IProcessTokenEntity>;
    getLaneRole(context: ExecutionContext): Promise<string>;
    start(context: ExecutionContext, source: IEntity): Promise<void>;
    changeState(context: ExecutionContext, newState: string, source: IEntity): void;
    error(context: ExecutionContext, error: any): void;
    execute(context: ExecutionContext): Promise<void>;
    proceed(context: ExecutionContext, data: any, source: IEntityReference, applicationId: string): Promise<void>;
    event(context: ExecutionContext, event: string, data: any): Promise<void>;
    cancel(context: ExecutionContext): Promise<void>;
    end(context: ExecutionContext, cancelFlow?: boolean): Promise<void>;
}
