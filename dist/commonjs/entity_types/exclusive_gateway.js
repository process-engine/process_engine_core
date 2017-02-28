"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
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
const core_contracts_1 = require("@process-engine-js/core_contracts");
const metadata_1 = require("@process-engine-js/metadata");
class ExclusiveGatewayEntity extends node_instance_1.NodeInstanceEntity {
    constructor(nodeInstanceEntityDependencyHelper, entityDependencyHelper) {
        super(nodeInstanceEntityDependencyHelper, entityDependencyHelper);
    }
    initialize(derivedClassInstance) {
        const _super = name => super[name];
        return __awaiter(this, void 0, void 0, function* () {
            const actualInstance = derivedClassInstance || this;
            yield _super("initialize").call(this, actualInstance);
        });
    }
    get follow() {
        return this.getProperty(this, 'follow');
    }
    set follow(value) {
        this.setProperty(this, 'follow', value);
    }
    execute(context) {
        return __awaiter(this, void 0, void 0, function* () {
            const flowDefEntityType = yield this.datastoreService.getEntityType('FlowDef');
            const nodeDef = yield this.getNodeDef();
            const processDef = yield nodeDef.getProcessDef();
            const internalContext = yield this.iamService.createInternalContext('processengine_system');
            const flowsOut = yield flowDefEntityType.query(internalContext, {
                query: [
                    { attribute: 'source', operator: '=', value: nodeDef.id },
                    { attribute: 'processDef', operator: '=', value: processDef.id }
                ]
            });
        });
    };
    Object.defineProperty(ExclusiveGatewayEntity.prototype, "follow", {
        get: function () {
            return this.getProperty(this, 'follow');
        },
        set: function (value) {
            this.setProperty(this, 'follow', value);
        },
        enumerable: true,
        configurable: true
    });
    ExclusiveGatewayEntity.prototype.execute = function (context) {
        return __awaiter(this, void 0, void 0, function () {
            var flowDefEntityType, nodeDef, processDef, internalContext, flowsOut, flowsIn, follow, i, flow, processToken, tokenData, result, functionString, evaluateFunction;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.helper.datastoreService.getEntityType('FlowDef')];
                    case 1:
                        flowDefEntityType = _a.sent();
                        return [4 /*yield*/, this.getNodeDef()];
                    case 2:
                        nodeDef = _a.sent();
                        return [4 /*yield*/, nodeDef.getProcessDef()];
                    case 3:
                        processDef = _a.sent();
                        return [4 /*yield*/, this.helper.iamService.createInternalContext('processengine_system')];
                    case 4:
                        internalContext = _a.sent();
                        return [4 /*yield*/, flowDefEntityType.query(internalContext, {
                                query: [
                                    { attribute: 'source', operator: '=', value: nodeDef.id },
                                    { attribute: 'processDef', operator: '=', value: processDef.id }
                                ]
                            })];
                    case 5:
                        flowsOut = _a.sent();
                        return [4 /*yield*/, flowDefEntityType.query(internalContext, {
                                query: [
                                    { attribute: 'target', operator: '=', value: nodeDef.id },
                                    { attribute: 'processDef', operator: '=', value: processDef.id }
                                ]
                            })];
                    case 6:
                        flowsIn = _a.sent();
                        if (!(flowsOut && flowsOut.length > 1 && flowsIn && flowsIn.length === 1)) return [3 /*break*/, 12];
                        follow = [];
                        i = 0;
                        _a.label = 7;
                    case 7:
                        if (!(i < flowsOut.data.length)) return [3 /*break*/, 11];
                        flow = flowsOut.data[i];
                        if (!flow.condition) return [3 /*break*/, 9];
                        return [4 /*yield*/, this.getProcessToken()];
                    case 8:
                        processToken = _a.sent();
                        tokenData = processToken.data || {};
                        result = false;
                        try {
                            const functionString = 'return ' + flow.condition;
                            const evaluateFunction = new Function(functionString);
                            result = evaluateFunction.call(tokenData);
                        }
                        catch (err) {
                        }
                        if (result) {
                            follow.push(flow.id);
                        }
                    }
                    else {
                        follow.push(flow.id);
                    }
                }
                this.follow = follow;
            }
            if (flowsIn && flowsIn.length > 1 && flowsOut && flowsOut.length === 1) {
            }
            this.state = 'progress';
            yield this.save(internalContext);
            yield this.changeState(context, 'end', this);
        });
    }
}
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.object })
], ExclusiveGatewayEntity.prototype, "follow", null);
exports.ExclusiveGatewayEntity = ExclusiveGatewayEntity;

//# sourceMappingURL=exclusive_gateway.js.map
