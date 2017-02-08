import { ExecutionContext, IFactory, IInheritedSchema, IEntity } from '@process-engine-js/core_contracts';
import { IDataModel, Entity, IEntityType, IPropertyBag } from '@process-engine-js/data_model_contracts';
import { IInvoker } from '@process-engine-js/invocation_contracts';
import { IProcessDefEntityTypeService, BpmnDiagram, IProcessDefEntity } from '@process-engine-js/process_engine_contracts';
export declare class ProcessDefEntity extends Entity implements IProcessDefEntity {
    static attributes: any;
    private _processDefEntityTypeService;
    private _dataModel;
    constructor(processDefEntityTypeService: IProcessDefEntityTypeService, dataModel: IDataModel, propertyBagFactory: IFactory<IPropertyBag>, invoker: IInvoker, entityType: IEntityType<IProcessDefEntity>, context: ExecutionContext, schema: IInheritedSchema);
    initialize(derivedClassInstance: IEntity): Promise<void>;
    private readonly processDefEntityTypeService;
    private readonly dataModel;
    name: string;
    key: string;
    defId: string;
    xml: string;
    start(context: ExecutionContext): Promise<void>;
    updateDefinitions(context: ExecutionContext, newBpmnDiagram?: BpmnDiagram): Promise<void>;
    private _updateLanes(lanes, context);
    private _updateNodes(nodes, laneCache, bpmnDiagram, context);
    private _updateFlows(flows, nodeCache, context);
    private _updateExtensionElements(extensionElements);
}
