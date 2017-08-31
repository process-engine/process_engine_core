import { IProcessDefEntityTypeService, IParamImportFromFile, IParamImportFromXml, IParamStart, IImportFromFileOptions, IProcessRepository, IImportFromXmlOptions } from '@process-engine-js/process_engine_contracts';
import { ExecutionContext, IPublicGetOptions, IEntityReference } from '@process-engine-js/core_contracts';
import { IInvoker } from '@process-engine-js/invocation_contracts';
import { IDatastoreService } from '@process-engine-js/data_model_contracts';
import { BpmnDiagram } from '../bpmn_diagram';
export declare class ProcessDefEntityTypeService implements IProcessDefEntityTypeService {
    private _datastoreService;
    private _processRepository;
    private _invoker;
    constructor(datastoreService: IDatastoreService, processRepository: IProcessRepository, invoker: IInvoker);
    private readonly datastoreService;
    private readonly invoker;
    private readonly processRepository;
    importBpmnFromFile(context: ExecutionContext, params: IParamImportFromFile, options?: IImportFromFileOptions): Promise<any>;
    importBpmnFromXml(context: ExecutionContext, params: IParamImportFromXml, options?: IImportFromXmlOptions): Promise<void>;
    parseBpmnXml(xml: string): Promise<BpmnDiagram>;
    start(context: ExecutionContext, params: IParamStart, options?: IPublicGetOptions): Promise<IEntityReference>;
}
