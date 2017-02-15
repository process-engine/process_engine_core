"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments)).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t;
    return { next: verb(0), "throw": verb(1), "return": verb(2) };
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = y[op[0] & 2 ? "return" : op[0] ? "throw" : "next"]) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [0, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var ProcessEngineService = (function () {
    function ProcessEngineService(messageBusService) {
        this._messageBusService = undefined;
        this._messageBusService = messageBusService;
    }
    Object.defineProperty(ProcessEngineService.prototype, "messageBusService", {
        get: function () {
            return this._messageBusService;
        },
        enumerable: true,
        configurable: true
    });
    ProcessEngineService.prototype.initialize = function () {
        return __awaiter(this, void 0, void 0, function () {
            var err_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.messageBusService.subscribe('/processengine', this._messageHandler.bind(this))];
                    case 1:
                        _a.sent();
                        return [3 /*break*/, 3];
                    case 2:
                        err_1 = _a.sent();
                        throw new Error(err_1.message);
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    ProcessEngineService.prototype.start = function (context, data, options) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, null];
            });
        });
    };
    ProcessEngineService.prototype._messageHandler = function (msg) {
        return __awaiter(this, void 0, void 0, function () {
            var action, ref, initialToken, source, context;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.messageBusService.verifyMessage(msg)];
                    case 1:
                        msg = _a.sent();
                        action = (msg && msg.data && msg.data.action) ? msg.data.action : null;
                        ref = (msg && msg.data && msg.data.ref) ? msg.data.ref : null;
                        initialToken = (msg && msg.data && msg.data.token) ? msg.data.token : null;
                        source = (msg && msg.origin) ? msg.origin : null;
                        context = (msg && msg.meta && msg.meta.context) ? msg.meta.context : {};
                        console.log(msg);
                        return [2 /*return*/];
                }
            });
        });
    };
    return ProcessEngineService;
}());
exports.ProcessEngineService = ProcessEngineService;

//# sourceMappingURL=process_engine_service.js.map
