import { ExecutionContext, IEntity, IPublicGetOptions } from '@process-engine-js/core_contracts';
import { Entity, EntityDependencyHelper } from '@process-engine-js/data_model_contracts';
import { IProcessDefEntityTypeService, IProcessDefEntity, IParamUpdateDefs, IParamStart, IProcessEntity } from '@process-engine-js/process_engine_contracts';
export declare class ProcessDefEntity extends Entity implements IProcessDefEntity {
    private _processDefEntityTypeService;
    constructor(processDefEntityTypeService: IProcessDefEntityTypeService, entityDependencyHelper: EntityDependencyHelper);
    initialize(derivedClassInstance: IEntity): Promise<void>;
    private readonly processDefEntityTypeService;
    name: string;
    key: string;
    defId: string;
    xml: string;
    start(context: ExecutionContext, params: IParamStart, options?: IPublicGetOptions): Promise<IProcessEntity>;
    updateBpmn(context: ExecutionContext, params?: any): Promise<any>;
    updateDefinitions(context: ExecutionContext, params?: IParamUpdateDefs): Promise<void>;
    private _updateLanes(lanes, context);
    private _updateNodes(nodes, laneCache, bpmnDiagram, context);
    private _updateFlows(flows, nodeCache, context);
    private _createBoundaries(nodes, nodeCache, context);
    private _updateExtensionElements(extensionElements);
}
