import { IProcessDefEntityTypeService, BpmnDiagram, IParamImportFromFile, IParamImportFromXml, IParamStart, IImportFromFileOptions, IProcessRepository } from '@process-engine-js/process_engine_contracts';
import { ExecutionContext, IPublicGetOptions, IFactory, IEntityReference } from '@process-engine-js/core_contracts';
import { IInvoker } from '@process-engine-js/invocation_contracts';
import { IDatastoreService } from '@process-engine-js/data_model_contracts';
export declare class ProcessDefEntityTypeService implements IProcessDefEntityTypeService {
    private _datastoreService;
    private _datastoreServiceFactory;
    private _processRepository;
    private _invoker;
    constructor(datastoreServiceFactory: IFactory<IDatastoreService>, processRepository: IProcessRepository, invoker: IInvoker);
    private readonly datastoreService;
    private readonly invoker;
    private readonly processRepository;
    importBpmnFromFile(context: ExecutionContext, params: IParamImportFromFile, options?: IImportFromFileOptions): Promise<any>;
    importBpmnFromXml(context: ExecutionContext, params: IParamImportFromXml, options?: IImportFromFileOptions): Promise<void>;
    parseBpmnXml(xml: string): Promise<BpmnDiagram>;
    start(context: ExecutionContext, params: IParamStart, options?: IPublicGetOptions): Promise<IEntityReference>;
}
