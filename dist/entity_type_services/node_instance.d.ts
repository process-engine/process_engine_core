import { INodeInstanceEntityTypeService, IParamsContinueFromRemote } from '@process-engine-js/process_engine_contracts';
import { ExecutionContext, IPublicGetOptions, IEntity, IIamService, IFactory } from '@process-engine-js/core_contracts';
import { IDatastoreService, IEntityType } from '@process-engine-js/data_model_contracts';
import { IMessageBusService } from '@process-engine-js/messagebus_contracts';
import { IFeatureService } from '@process-engine-js/feature_contracts';
import { IRoutingService } from '@process-engine-js/routing_contracts';
import { IEventAggregator } from '@process-engine-js/event_aggregator_contracts';
export declare class NodeInstanceEntityTypeService implements INodeInstanceEntityTypeService {
    private _datastoreService;
    private _datastoreServiceFactory;
    private _messagebusService;
    private _eventAggregator;
    private _iamService;
    private _featureService;
    private _routingService;
    constructor(datastoreServiceFactory: IFactory<IDatastoreService>, messagebusService: IMessageBusService, iamService: IIamService, eventAggregator: IEventAggregator, featureService: IFeatureService, routingService: IRoutingService);
    private readonly datastoreService;
    private readonly messagebusService;
    private readonly eventAggregator;
    private readonly iamService;
    private readonly featureService;
    private readonly routingService;
    private _nodeHandler(event);
    private _nodeHandlerMessagebus(msg);
    createNode(context: ExecutionContext, entityType: IEntityType<IEntity>): Promise<IEntity>;
    createNextNode(context: ExecutionContext, source: any, nextDef: any, token: any): Promise<void>;
    continueExecution(context: ExecutionContext, source: IEntity): Promise<void>;
    continueFromRemote(context: ExecutionContext, params: IParamsContinueFromRemote, options?: IPublicGetOptions): Promise<void>;
}
