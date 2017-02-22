import { INodeInstanceEntityTypeService } from '@process-engine-js/process_engine_contracts';
import { ExecutionContext, IEntity } from '@process-engine-js/core_contracts';
import { IDatastoreService, IEntityType } from '@process-engine-js/data_model_contracts';
import { IMessageBusService } from '@process-engine-js/messagebus_contracts';
import { IIamService } from '@process-engine-js/iam_contracts';
export declare class NodeInstanceEntityTypeService implements INodeInstanceEntityTypeService {
    private _datastoreService;
    private _messagebusService;
    private _iamService;
    constructor(datastoreService: IDatastoreService, messagebusService: IMessageBusService, iamService: IIamService);
    private readonly datastoreService;
    private readonly messagebusService;
    private readonly iamService;
    createNode(context: ExecutionContext, entityType: IEntityType<IEntity>): Promise<IEntity>;
    createNextNode(context: ExecutionContext, source: any, nextDef: any, token: any): Promise<void>;
}
