import { IProcessEngineService, IProcessDefEntityTypeService, IParamStart } from '@process-engine-js/process_engine_contracts';
import { IMessageBusService } from '@process-engine-js/messagebus_contracts';
import { ExecutionContext, IPublicGetOptions } from '@process-engine-js/core_contracts';
import * as debug from 'debug';

const debugInfo = debug('process_engine:info');
const debugErr = debug('process_engine:error');


export class ProcessEngineService implements IProcessEngineService {

  private _messageBusService: IMessageBusService = undefined;
  private _processDefEntityTypeService: IProcessDefEntityTypeService = undefined;

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

  async initialize(): Promise<void> {
    try {
      await this.messageBusService.subscribe('/processengine', this._messageHandler.bind(this));
      debugInfo('subscribed on Messagebus');
    } catch (err) {
      debugErr('subscription failed on Messagebus', err.message);
      throw new Error(err.message);
    }
  }

  public async start(context: ExecutionContext, params: IParamStart, options?: IPublicGetOptions): Promise<string> {
    const id = await this.processDefEntityTypeService.start(context, params, options);
    return id;
  }

  private async _messageHandler(msg): Promise<void> {
    debugInfo('we got a message: ', msg);

    msg = await this.messageBusService.verifyMessage(msg);

    const action = (msg && msg.data && msg.data.action) ? msg.data.action : null;
    const key = (msg && msg.data && msg.data.key) ? msg.data.key : null;
    const initialToken = (msg && msg.data && msg.data.token) ? msg.data.token : null;
    const source = (msg && msg.origin) ? msg.origin : null;

    const context = (msg && msg.meta && msg.meta.context) ? msg.meta.context : {};

    switch (action) {
      case 'start':

        const params: IParamStart = {
          key: key,
          initialToken: initialToken,
          source: source
        };

        const id = await this.processDefEntityTypeService.start(context, params);
        debugInfo(`process id ${id} started: `);
        break;
      default:
        debugInfo('unhandled action: ', msg);
        break;
    }
  }
}
