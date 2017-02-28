"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
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
var node_instance_1 = require("./node_instance");
var ServiceTaskEntity = (function (_super) {
    __extends(ServiceTaskEntity, _super);
    function ServiceTaskEntity(nodeInstanceHelper, container, propertyBagFactory, encryptionService, invoker, entityType, context, schema) {
        var _this = _super.call(this, nodeInstanceHelper, propertyBagFactory, encryptionService, invoker, entityType, context, schema) || this;
        _this._container = undefined;
        _this._container = container;
        return _this;
    }
    Object.defineProperty(ServiceTaskEntity.prototype, "container", {
        get: function () {
            return this._container;
        },
        enumerable: true,
        configurable: true
    });
    ServiceTaskEntity.prototype.initialize = function (derivedClassInstance) {
        return __awaiter(this, void 0, void 0, function () {
            var actualInstance;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        actualInstance = derivedClassInstance || this;
                        return [4 /*yield*/, _super.prototype.initialize.call(this, actualInstance)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    ServiceTaskEntity.prototype.execute = function (context) {
        return __awaiter(this, void 0, void 0, function () {
            var internalContext, processToken, tokenData, continueEnd, nodeDef, extensions, props, serviceModule_1, serviceMethod_1, paramString_1, service, params, result, functionString, evaluateFunction, err_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.helper.iamService.createInternalContext('processengine_system')];
                    case 1:
                        internalContext = _a.sent();
                        this.state = 'progress';
                        return [4 /*yield*/, this.save(internalContext)];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, this.getProcessToken()];
                    case 3:
                        processToken = _a.sent();
                        tokenData = processToken.data || {};
                        continueEnd = true;
                        return [4 /*yield*/, this.getNodeDef()];
                    case 4:
                        nodeDef = _a.sent();
                        extensions = nodeDef.extensions || null;
                        props = (extensions && extensions.properties) ? extensions.properties : null;
                        if (!props) return [3 /*break*/, 11];
                        props.forEach(function (prop) {
                            if (prop.name === 'module') {
                                serviceModule_1 = prop.value;
                            }
                            if (prop.name === 'method') {
                                serviceMethod_1 = prop.value;
                            }
                            if (prop.name === 'params') {
                                paramString_1 = prop.value;
                            }
                        });
                        if (!(serviceModule_1 && serviceMethod_1)) return [3 /*break*/, 11];
                        service = this.container.resolve(serviceModule_1);
                        params = [];
                        result = void 0;
                        _a.label = 5;
                    case 5:
                        _a.trys.push([5, 7, , 9]);
                        functionString = 'return ' + paramString_1;
                        evaluateFunction = new Function(functionString);
                        params = evaluateFunction.call(tokenData);
                        return [4 /*yield*/, service[serviceMethod_1].apply(this, [context].concat(params))];
                    case 6:
                        result = _a.sent();
                        return [3 /*break*/, 9];
                    case 7:
                        err_1 = _a.sent();
                        result = err_1;
                        continueEnd = false;
                        return [4 /*yield*/, this.error(context, err_1)];
                    case 8:
                        _a.sent();
                        return [3 /*break*/, 9];
                    case 9:
                        tokenData.current = result;
                        processToken.data = tokenData;
                        return [4 /*yield*/, processToken.save(null, internalContext)];
                    case 10:
                        _a.sent();
                        _a.label = 11;
                    case 11:
                        if (!continueEnd) return [3 /*break*/, 13];
                        return [4 /*yield*/, this.changeState(context, 'end', this)];
                    case 12:
                        _a.sent();
                        _a.label = 13;
                    case 13: return [2 /*return*/];
                }
            });
        });
    };
    return ServiceTaskEntity;
}(node_instance_1.NodeInstanceEntity));
exports.ServiceTaskEntity = ServiceTaskEntity;

//# sourceMappingURL=service_task.js.map
