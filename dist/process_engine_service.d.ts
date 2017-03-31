import { IProcessEngineService, IProcessDefEntityTypeService, IParamStart } from '@process-engine-js/process_engine_contracts';
import { IMessageBusService } from '@process-engine-js/messagebus_contracts';
import { ExecutionContext, IPublicGetOptions, IIamService } from '@process-engine-js/core_contracts';
import { IFeatureService } from '@process-engine-js/feature_contracts';
export declare class ProcessEngineService implements IProcessEngineService {
    private _messageBusService;
    private _processDefEntityTypeService;
    private _featureService;
    private _iamService;
    private _runningProcesses;
    private _id;
    config: any;
    constructor(messageBusService: IMessageBusService, processDefEntityTypeService: IProcessDefEntityTypeService, featureService: IFeatureService, iamService: IIamService);
    private readonly messageBusService;
    private readonly processDefEntityTypeService;
    private readonly featureService;
    private readonly iamService;
    private readonly runningProcesses;
    readonly id: string;
    initialize(): Promise<void>;
    start(context: ExecutionContext, params: IParamStart, options?: IPublicGetOptions): Promise<string>;
    private _messageHandler(msg);
}
