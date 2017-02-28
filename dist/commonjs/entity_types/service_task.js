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
const node_instance_1 = require("./node_instance");
class ServiceTaskEntity extends node_instance_1.NodeInstanceEntity {
    constructor(container, nodeInstanceEntityDependencyHelper, entityDependencyHelper) {
        super(nodeInstanceEntityDependencyHelper, entityDependencyHelper);
        this._container = undefined;
        this._container = container;
    }
    get container() {
        return this._container;
    }
    initialize(derivedClassInstance) {
        const _super = name => super[name];
        return __awaiter(this, void 0, void 0, function* () {
            const actualInstance = derivedClassInstance || this;
            yield _super("initialize").call(this, actualInstance);
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
                        result = yield service[serviceMethod].apply(this, [context].concat(params));
                    }
                    catch (err) {
                        result = err;
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
            }
            if (continueEnd) {
                yield this.changeState(context, 'end', this);
            }
        });
    }
}
exports.ServiceTaskEntity = ServiceTaskEntity;

//# sourceMappingURL=service_task.js.map
