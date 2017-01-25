import { IProcessDefEntityTypeService, BpmnDiagram } from '@process-engine-js/process_engine_contracts';
import { IDataModel } from '@process-engine-js/data_model_contracts';
import { ExecutionContext } from '@process-engine-js/core_contracts';
import { IInvoker } from '@process-engine-js/invocation_contracts';
export declare class ProcessDefEntityTypeService implements IProcessDefEntityTypeService {
    private _dataModel;
    private _invoker;
    constructor(dataModel: IDataModel, invoker: IInvoker);
    private readonly dataModel;
    private readonly invoker;
    importBpmnFromFile(path: string): Promise<void>;
    importBpmnFromXml(xml: string, context: ExecutionContext): Promise<void>;
    parseBpmnXml(xml: string): Promise<BpmnDiagram>;
    parseBpmnFile(path: string): Promise<BpmnDiagram>;
}
