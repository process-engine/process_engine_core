import { IProcessDefEntityTypeService, BpmnDiagram, IParamImportFromFile, IParamImportFromXml, IParamStart, IProcessEntity } from '@process-engine-js/process_engine_contracts';
import { ExecutionContext, IPublicGetOptions } from '@process-engine-js/core_contracts';
import { IInvoker } from '@process-engine-js/invocation_contracts';
import { IDatastoreService } from '@process-engine-js/data_model_contracts';
export declare class ProcessDefEntityTypeService implements IProcessDefEntityTypeService {
    private _datastoreService;
    private _invoker;
    constructor(datastoreService: IDatastoreService, invoker: IInvoker);
    private readonly datastoreService;
    private readonly invoker;
    importBpmnFromFile(context: ExecutionContext, params: IParamImportFromFile, options?: IPublicGetOptions): Promise<any>;
    private _getFile(path);
    importBpmnFromXml(context: ExecutionContext, params: IParamImportFromXml, options?: IPublicGetOptions): Promise<void>;
    parseBpmnXml(xml: string): Promise<BpmnDiagram>;
    parseBpmnFile(path: string): Promise<BpmnDiagram>;
    start(context: ExecutionContext, params: IParamStart, options?: IPublicGetOptions): Promise<IProcessEntity>;
}
