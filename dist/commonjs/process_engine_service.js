"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const debug = require("debug");
const uuid = require("uuid");
const debugInfo = debug('process_engine:info');
const debugErr = debug('process_engine:error');
class ProcessEngineService {
    constructor(messageBusService, processDefEntityTypeService) {
        this._messageBusService = undefined;
        this._processDefEntityTypeService = undefined;
        this._runningProcesses = {};
        this._id = undefined;
        this.config = undefined;
        this._messageBusService = messageBusService;
        this._processDefEntityTypeService = processDefEntityTypeService;
    }
    get messageBusService() {
        return this._messageBusService;
    }
    get processDefEntityTypeService() {
        return this._processDefEntityTypeService;
    }
    get runningProcesses() {
        return this._runningProcesses;
    }
    get id() {
        return this._id;
    }
    async initialize() {
        this._id = this.config.id || uuid.v4();
        try {
            await this.messageBusService.subscribe(`/processengine/${this.id}`, this._messageHandler.bind(this));
            debugInfo(`subscribed on Messagebus with id ${this.id}`);
        }
        catch (err) {
            debugErr('subscription failed on Messagebus', err.message);
            throw new Error(err.message);
        }
    }
    async start(context, params, options) {
        const processEntity = await this.processDefEntityTypeService.start(context, params, options);
        this.runningProcesses[processEntity.id] = processEntity;
        return processEntity.id;
    }
    async _messageHandler(msg) {
        debugInfo('we got a message: ', msg);
        msg = await this.messageBusService.verifyMessage(msg);
        const action = (msg && msg.data && msg.data.action) ? msg.data.action : null;
        const key = (msg && msg.data && msg.data.key) ? msg.data.key : null;
        const initialToken = (msg && msg.data && msg.data.token) ? msg.data.token : null;
        const source = (msg && msg.origin) ? msg.origin : null;
        const context = (msg && msg.meta && msg.meta.context) ? msg.meta.context : {};
        switch (action) {
            case 'start':
                const params = {
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
exports.ProcessEngineService = ProcessEngineService;

//# sourceMappingURL=process_engine_service.js.map
