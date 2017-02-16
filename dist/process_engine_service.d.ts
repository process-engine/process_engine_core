import { IProcessEngineService, IProcessDefEntityTypeService, IParamStart } from '@process-engine-js/process_engine_contracts';
import { IMessageBusService } from '@process-engine-js/messagebus_contracts';
import { ExecutionContext, IPublicGetOptions } from '@process-engine-js/core_contracts';
export declare class ProcessEngineService implements IProcessEngineService {
    private _messageBusService;
    private _processDefEntityTypeService;
    constructor(messageBusService: IMessageBusService, processDefEntityTypeService: IProcessDefEntityTypeService);
    private readonly messageBusService;
    private readonly processDefEntityTypeService;
    initialize(): Promise<void>;
    start(context: ExecutionContext, params: IParamStart, options?: IPublicGetOptions): Promise<string>;
    private _messageHandler(msg);
}
