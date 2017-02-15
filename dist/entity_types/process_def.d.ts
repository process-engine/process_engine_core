import { ExecutionContext, IFactory, IInheritedSchema, IEntity } from '@process-engine-js/core_contracts';
import { Entity, IEntityType, IPropertyBag, IEncryptionService, IDatastoreService } from '@process-engine-js/data_model_contracts';
import { IInvoker } from '@process-engine-js/invocation_contracts';
import { IProcessDefEntityTypeService, IProcessDefEntity, IParamUpdateDefs } from '@process-engine-js/process_engine_contracts';
export declare class ProcessDefEntity extends Entity implements IProcessDefEntity {
    private _processDefEntityTypeService;
    private _datastoreService;
    constructor(processDefEntityTypeService: IProcessDefEntityTypeService, datastoreService: IDatastoreService, propertyBagFactory: IFactory<IPropertyBag>, encryptionService: IEncryptionService, invoker: IInvoker, entityType: IEntityType<IProcessDefEntity>, context: ExecutionContext, schema: IInheritedSchema);
    initialize(derivedClassInstance: IEntity): Promise<void>;
    private readonly processDefEntityTypeService;
    private readonly datastoreService;
    name: string;
    key: string;
    defId: string;
    xml: string;
    start(context: ExecutionContext): Promise<void>;
    updateBpmn(context: ExecutionContext, params?: any): Promise<any>;
    updateDefinitions(context: ExecutionContext, params?: IParamUpdateDefs): Promise<void>;
    private _updateLanes(lanes, context);
    private _updateNodes(nodes, laneCache, bpmnDiagram, context);
    private _updateFlows(flows, nodeCache, context);
    private _createBoundaries(nodes, nodeCache, context);
    private _updateExtensionElements(extensionElements);
}
