import { ExecutionContext, IInheritedSchema, IEntity, IIamService } from '@process-engine-js/core_contracts';
import { Entity, EntityDependencyHelper, EntityReference } from '@process-engine-js/data_model_contracts';
import { INodeInstanceEntity, INodeInstanceEntityTypeService, INodeDefEntity, IProcessEntity, IProcessTokenEntity } from '@process-engine-js/process_engine_contracts';
import { IMessageBusService } from '@process-engine-js/messagebus_contracts';
export declare class NodeInstanceEntityDependencyHelper {
    messageBusService: IMessageBusService;
    iamService: IIamService;
    nodeInstanceEntityTypeService: INodeInstanceEntityTypeService;
    constructor(messageBusService: IMessageBusService, iamService: IIamService, nodeInstanceEntityTypeService: INodeInstanceEntityTypeService);
}
export declare class NodeInstanceEntity extends Entity implements INodeInstanceEntity {
    private _nodeInstanceEntityDependencyHelper;
    constructor(nodeInstanceEntityDependencyHelper: NodeInstanceEntityDependencyHelper, entityDependencyHelper: EntityDependencyHelper, context: ExecutionContext, schema: IInheritedSchema);
    protected readonly iamService: IIamService;
    protected readonly messageBusService: IMessageBusService;
    protected readonly nodeInstanceEntityTypeService: INodeInstanceEntityTypeService;
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
    changeState(context: ExecutionContext, newState: string, source: IEntity): Promise<void>;
    error(context: ExecutionContext, error: any): Promise<void>;
    execute(context: ExecutionContext): Promise<void>;
    proceed(context: ExecutionContext, data: any, source: EntityReference, applicationId: string): Promise<void>;
    event(context: ExecutionContext, event: string, data: any): Promise<void>;
    cancel(context: ExecutionContext): Promise<void>;
    end(context: ExecutionContext, cancelFlow?: boolean): Promise<void>;
}
