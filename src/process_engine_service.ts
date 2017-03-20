import { IProcessEngineService, IProcessDefEntityTypeService, IParamStart, IProcessEntity } from '@process-engine-js/process_engine_contracts';
import { IMessageBusService } from '@process-engine-js/messagebus_contracts';
import { ExecutionContext, IPublicGetOptions } from '@process-engine-js/core_contracts';
import * as debug from 'debug';
import * as uuid from 'uuid';

const debugInfo = debug('process_engine:info');
const debugErr = debug('process_engine:error');


export class ProcessEngineService implements IProcessEngineService {

  private _messageBusService: IMessageBusService = undefined;
  private _processDefEntityTypeService: IProcessDefEntityTypeService = undefined;
  private _runningProcesses: any = {};
  private _id: string = undefined;

  public config: any = undefined;
  
  constructor(messageBusService: IMessageBusService, processDefEntityTypeService: IProcessDefEntityTypeService) {
    this._messageBusService = messageBusService;
    this._processDefEntityTypeService = processDefEntityTypeService;
  }

  private get messageBusService(): IMessageBusService {
    return this._messageBusService;
  }

  private get processDefEntityTypeService(): IProcessDefEntityTypeService {
    return this._processDefEntityTypeService;
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
    } catch (err) {
      debugErr('subscription failed on Messagebus', err.message);
      throw new Error(err.message);
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
