import { IProcessDefEntityTypeService, BpmnDiagram, IParamImportFromFile, IParamImportFromXml, IParamStart, IProcessEntity, IImportFromFileOptions } from '@process-engine-js/process_engine_contracts';
import { ExecutionContext, IPublicGetOptions, IFactory } from '@process-engine-js/core_contracts';
import { IInvoker } from '@process-engine-js/invocation_contracts';
import { IDatastoreService } from '@process-engine-js/data_model_contracts';
export declare class ProcessDefEntityTypeService implements IProcessDefEntityTypeService {
    private _datastoreService;
    private _datastoreServiceFactory;
    private _invoker;
    constructor(datastoreServiceFactory: IFactory<IDatastoreService>, invoker: IInvoker);
    private readonly datastoreService;
    private readonly invoker;
    importBpmnFromFile(context: ExecutionContext, params: IParamImportFromFile, options?: IImportFromFileOptions): Promise<any>;
    private _getFile(path);
    importBpmnFromXml(context: ExecutionContext, params: IParamImportFromXml, options?: IImportFromFileOptions): Promise<void>;
    parseBpmnXml(xml: string): Promise<BpmnDiagram>;
    parseBpmnFile(path: string): Promise<BpmnDiagram>;
    start(context: ExecutionContext, params: IParamStart, options?: IPublicGetOptions): Promise<IProcessEntity>;
    createProcess(context: any, token: any): Promise<any>;
}
