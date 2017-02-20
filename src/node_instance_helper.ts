import { IDatastoreService } from '@process-engine-js/data_model_contracts';
import { IMessageBusService } from '@process-engine-js/messagebus_contracts';
import { IIamService } from '@process-engine-js/iam_contracts';

export class NodeInstanceHelper {
  private _datastoreService: IDatastoreService = undefined;
  private _messagebusService: IMessageBusService = undefined;
  private _iamService: IIamService = undefined;

  constructor(datastoreService: IDatastoreService, messagebusService: IMessageBusService, iamService: IIamService) {
    this._datastoreService = datastoreService;
    this._messagebusService = messagebusService;
    this._iamService = iamService;
  }

  private get datastoreService(): IDatastoreService {
    return this._datastoreService;
  }

  private get messagebusService(): IMessageBusService {
    return this._messagebusService;
  }

  private get iamService(): IIamService {
    return this._iamService;
  }
};
