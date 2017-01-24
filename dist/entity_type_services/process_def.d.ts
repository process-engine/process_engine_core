import { IProcessDefEntityTypeService, BpmnDiagram } from 'process_engine_contracts';
import { IDataModel } from 'data_model_contracts';
import { ExecutionContext } from 'iam_contracts';
import { IInvoker } from 'invocation_contracts';
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
