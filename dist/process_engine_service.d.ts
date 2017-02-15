import { IProcessEngineService } from '@process-engine-js/process_engine_contracts';
import { IMessageBusService } from '@process-engine-js/messagebus_contracts';
import { ExecutionContext, IPublicGetOptions } from '@process-engine-js/core_contracts';
export declare class ProcessEngineService implements IProcessEngineService {
    private _messageBusService;
    constructor(messageBusService: IMessageBusService);
    private readonly messageBusService;
    initialize(): Promise<void>;
    start(context: ExecutionContext, data: any, options: IPublicGetOptions): Promise<any>;
    private _messageHandler(msg);
}
