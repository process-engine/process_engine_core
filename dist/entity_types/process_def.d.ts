import { Entity, IEntityType, IPropertyBag, IFactory, IDataModel, ISchemas } from 'data_model_contracts';
import { IInvoker } from 'invocation_contracts';
import { ExecutionContext } from 'iam_contracts';
import { IProcessDefEntityTypeService, BpmnDiagram } from 'process_engine_contracts';
export declare class ProcessDefEntity extends Entity {
    static attributes: any;
    private _processDefEntityTypeService;
    private _dataModel;
    constructor(processDefEntityTypeService: IProcessDefEntityTypeService, dataModel: IDataModel, propertyBagFactory: IFactory<IPropertyBag>, invoker: IInvoker, entityType: IEntityType<ProcessDefEntity>, context: ExecutionContext, schemas: ISchemas);
    private readonly processDefEntityTypeService;
    private readonly dataModel;
    readonly xml: any;
    readonly key: any;
    start(context: ExecutionContext): Promise<void>;
    updateDefinitions(context: ExecutionContext, newBpmnDiagram?: BpmnDiagram): Promise<void>;
    private _updateLanes(lanes, context);
    private _updateNodes(nodes, laneCache, bpmnDiagram, context);
    private _updateFlows(flows, nodeCache, context);
    private _updateExtensionElements(extensionElements);
}
