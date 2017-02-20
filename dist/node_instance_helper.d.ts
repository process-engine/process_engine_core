import { IDatastoreService } from '@process-engine-js/data_model_contracts';
import { IMessageBusService } from '@process-engine-js/messagebus_contracts';
import { IIamService } from '@process-engine-js/iam_contracts';
export declare class NodeInstanceHelper {
    private _datastoreService;
    private _messagebusService;
    private _iamService;
    constructor(datastoreService: IDatastoreService, messagebusService: IMessageBusService, iamService: IIamService);
    private readonly datastoreService;
    private readonly messagebusService;
    private readonly iamService;
}
