import { IProcessEngineService, IProcessDefEntityTypeService, IParamStart, IProcessEntity, IImportFromFileOptions, IParamImportFromFile } from '@process-engine-js/process_engine_contracts';
import { IMessageBusService } from '@process-engine-js/messagebus_contracts';
import { ExecutionContext, IPublicGetOptions, IIamService } from '@process-engine-js/core_contracts';
import { IFeatureService } from '@process-engine-js/feature_contracts';

import * as debug from 'debug';
import * as uuidModule from 'uuid';

const debugInfo = debug('process_engine:info');
const debugErr = debug('process_engine:error');

const uuid: any = uuidModule;

export class ProcessEngineService implements IProcessEngineService {

  private _messageBusService: IMessageBusService = undefined;
  private _processDefEntityTypeService: IProcessDefEntityTypeService = undefined;
  private _featureService: IFeatureService = undefined;
  private _iamService: IIamService = undefined;

  private _runningProcesses: any = {};
  private _id: string = undefined;

  public config: any = undefined;

  constructor(messageBusService: IMessageBusService, processDefEntityTypeService: IProcessDefEntityTypeService, featureService: IFeatureService, iamService: IIamService) {
    this._messageBusService = messageBusService;
    this._processDefEntityTypeService = processDefEntityTypeService;
    this._featureService = featureService;
    this._iamService = iamService;
  }

  private get messageBusService(): IMessageBusService {
    return this._messageBusService;
  }

  private get processDefEntityTypeService(): IProcessDefEntityTypeService {
    return this._processDefEntityTypeService;
  }

  private get featureService(): IFeatureService {
    return this._featureService;
  }

  private get iamService(): IIamService {
    return this._iamService;
  }

  private get runningProcesses(): any {
    return this._runningProcesses;
  }

  public get id(): string {
    return this._id;
  }

  async initialize(): Promise<void> {
    this._id = this.config.id || uuid.v4();
    try {
      await this.messageBusService.subscribe(`/processengine/${this.id}`, this._messageHandler.bind(this));
      debugInfo(`subscribed on Messagebus with id ${this.id}`);

      // we still subscribe on the old channel to leave frontend intact
      if (this.messageBusService.isMaster) {
        await this.messageBusService.subscribe(`/processengine`, this._messageHandler.bind(this));
        debugInfo(`subscribed on Messagebus Master`);
      }

    } catch (err) {
      debugErr('subscription failed on Messagebus', err.message);
      throw new Error(err.message);
    }


    const internalContext = await this.iamService.createInternalContext('processengine_system');
    const options: IImportFromFileOptions = {
      overwrite: false
    };

    const bpmns = [
      'createProcessDef.bpmn',
      'reservation.bpmn'
    ];

    for (let i = 0; i < bpmns.length; i++) {
      const params: IParamImportFromFile = {
        file: bpmns[i]
      };
      await this.processDefEntityTypeService.importBpmnFromFile(internalContext, params, options);
    }

  }

  public async start(context: ExecutionContext, params: IParamStart, options?: IPublicGetOptions): Promise<string> {
    const processEntity: IProcessEntity = await this.processDefEntityTypeService.start(context, params, options);
    this.runningProcesses[processEntity.id] = processEntity;
    return processEntity.id;
  }

  private async _messageHandler(msg): Promise<void> {
    debugInfo('we got a message: ', msg);

    msg = await this.messageBusService.verifyMessage(msg);

    const action: string = (msg && msg.data && msg.data.action) ? msg.data.action : null;
    const key: string = (msg && msg.data && msg.data.key) ? msg.data.key : null;
    const initialToken: any = (msg && msg.data && msg.data.token) ? msg.data.token : null;
    const source: any = (msg && msg.origin) ? msg.origin : null;

    const context = (msg && msg.meta && msg.meta.context) ? msg.meta.context : {};

    switch (action) {
      case 'start':

        const params: IParamStart = {
          key: key,
          initialToken: initialToken,
          source: source
        };

        const processEntity = await this.processDefEntityTypeService.start(context, params);
        debugInfo(`process id ${processEntity.id} started: `);
        break;
      default:
        debugInfo('unhandled action: ', msg);
        break;
    }
  }
}