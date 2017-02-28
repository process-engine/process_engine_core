"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const debug = require("debug");
const debugInfo = debug('process_engine:info');
const debugErr = debug('process_engine:error');
class ProcessEngineService {
    constructor(messageBusService, processDefEntityTypeService) {
        this._messageBusService = undefined;
        this._processDefEntityTypeService = undefined;
        this._runningProcesses = {};
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
    initialize() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.messageBusService.subscribe('/processengine', this._messageHandler.bind(this));
                debugInfo('subscribed on Messagebus');
            }
            catch (err) {
                debugErr('subscription failed on Messagebus', err.message);
                throw new Error(err.message);
            }
        });
    }
    start(context, params, options) {
        return __awaiter(this, void 0, void 0, function* () {
            const processEntity = yield this.processDefEntityTypeService.start(context, params, options);
            this.runningProcesses[processEntity.id] = processEntity;
            return processEntity.id;
        });
    }
    _messageHandler(msg) {
        return __awaiter(this, void 0, void 0, function* () {
            debugInfo('we got a message: ', msg);
            msg = yield this.messageBusService.verifyMessage(msg);
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
                    const processEntity = yield this.processDefEntityTypeService.start(context, params);
                    debugInfo(`process id ${processEntity.id} started: `);
                    break;
                default:
                    debugInfo('unhandled action: ', msg);
                    break;
            }
        });
    }
}
exports.ProcessEngineService = ProcessEngineService;

//# sourceMappingURL=process_engine_service.js.map
