import { IProcessEngineService } from '@process-engine-js/process_engine_contracts';
import { IMessageBusService } from '@process-engine-js/messagebus_contracts';
import { ExecutionContext, IPublicGetOptions } from '@process-engine-js/core_contracts';

export class ProcessEngineService implements IProcessEngineService {

  private _messageBusService: IMessageBusService = undefined;

  constructor(messageBusService: IMessageBusService) {
    this._messageBusService = messageBusService;
  }

  private get messageBusService(): IMessageBusService {
    return this._messageBusService;
  }

  async initialize(): Promise<void> {
    try {
      await this.messageBusService.subscribe('/processengine', this._messageHandler.bind(this));
      // debug('subscribed on Messagebus');
    } catch (err) {
      // debugerr('subscription failed on Messagebus', err.message);
      throw new Error(err.message);
    }
  }

  public async start(context: ExecutionContext, data: any, options: IPublicGetOptions): Promise<any> {
    return null;
  }

  private async _messageHandler(msg): Promise<void> {
    // debug('we got a message: ', msg);

    msg = await this.messageBusService.verifyMessage(msg);

    const action = (msg && msg.data && msg.data.action) ? msg.data.action : null;
    const ref = (msg && msg.data && msg.data.ref) ? msg.data.ref : null;
    const initialToken = (msg && msg.data && msg.data.token) ? msg.data.token : null;
    const source = (msg && msg.origin) ? msg.origin : null;

    const context = (msg && msg.meta && msg.meta.context) ? msg.meta.context : {};

    console.log(msg);

    // switch (action) {
    //   case 'start':
    //     this.model.ProcessDef.start(context, ref, initialToken, source);
    //     debug('process started: ');
    //     break;
    //   default:
    //     debug('unhandled action: ', msg);
    //     break;
    // }
  }
}
