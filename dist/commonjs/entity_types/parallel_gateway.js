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
const core_contracts_1 = require("@process-engine-js/core_contracts");
const node_instance_1 = require("./node_instance");
const metadata_1 = require("@process-engine-js/metadata");
class ParallelGatewayEntity extends node_instance_1.NodeInstanceEntity {
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
    get parallelType() {
        return this.getProperty(this, 'parallelType');
    }
    set parallelType(value) {
        this.setProperty(this, 'parallelType', value);
    }
    execute(context) {
        return __awaiter(this, void 0, void 0, function* () {
            const flowDefEntityType = yield this.datastoreService.getEntityType('FlowDef');
            const nodeDef = yield this.getNodeDef();
            const processDef = yield nodeDef.getProcessDef();
            const internalContext = yield this.iamService.createInternalContext('processengine_system');
            const flowsOut = yield flowDefEntityType.query(internalContext, {
                query: [
                    { attribute: 'source.id', operator: '=', value: nodeDef.id },
                    { attribute: 'processDef.id', operator: '=', value: processDef.id }
                ]
            });
        });
    };
    Object.defineProperty(ParallelGatewayEntity.prototype, "parallelType", {
        get: function () {
            return this.getProperty(this, 'parallelType');
        },
        set: function (value) {
            this.setProperty(this, 'parallelType', value);
        },
        enumerable: true,
        configurable: true
    });
    ParallelGatewayEntity.prototype.execute = function (context) {
        return __awaiter(this, void 0, void 0, function () {
            var flowDefEntityType, nodeDef, processDef, internalContext, flowsOut, flowsIn;
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
                                    { attribute: 'source.id', operator: '=', value: nodeDef.id },
                                    { attribute: 'processDef.id', operator: '=', value: processDef.id }
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
                        if (!(flowsOut && flowsOut.length > 1 && flowsIn && flowsIn.length === 1)) return [3 /*break*/, 9];
                        this.parallelType = 'split';
                        this.state = 'progress';
                        return [4 /*yield*/, this.save(internalContext)];
                    case 7:
                        _a.sent();
                        return [4 /*yield*/, this.changeState(context, 'end', this)];
                    case 8:
                        _a.sent();
                        _a.label = 9;
                    case 9:
                        if (!(flowsIn && flowsIn.length > 1 && flowsOut && flowsOut.length === 1)) return [3 /*break*/, 11];
                        this.parallelType = 'join';
                        this.state = 'progress';
                        return [4 /*yield*/, this.save(internalContext)];
                    case 10:
                        _a.sent();
                        _a.label = 11;
                    case 11: return [2 /*return*/];
                }
            });
            if (flowsOut && flowsOut.length > 1 && flowsIn && flowsIn.length === 1) {
                this.parallelType = 'split';
                this.state = 'progress';
                yield this.save(internalContext);
                yield this.changeState(context, 'end', this);
            }
            if (flowsIn && flowsIn.length > 1 && flowsOut && flowsOut.length === 1) {
                this.parallelType = 'join';
                this.state = 'progress';
                yield this.save(internalContext);
            }
        });
    };
    ParallelGatewayEntity.prototype.proceed = function (context, newData, source) {
        return __awaiter(this, void 0, void 0, function () {
            var flowDefEntityType, nodeDefEntityType, sourceEntityType, prevDefs, nodeDef, processDef, flowsIn, internalContext, ids, i, flow, source_1, queryIn, keys_1, sourceEnt, token, allthere_1, processToken, tokenData_1, merged;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.helper.datastoreService.getEntityType('FlowDef')];
                    case 1:
                        flowDefEntityType = _a.sent();
                        return [4 /*yield*/, this.helper.datastoreService.getEntityType('NodeDef')];
                    case 2:
                        nodeDefEntityType = _a.sent();
                        return [4 /*yield*/, this.helper.datastoreService.getEntityType(source.type)];
                    case 3:
                        sourceEntityType = _a.sent();
                        prevDefs = null;
                        return [4 /*yield*/, this.getNodeDef()];
                    case 4:
                        nodeDef = _a.sent();
                        return [4 /*yield*/, nodeDef.getProcessDef()];
                    case 5:
                        processDef = _a.sent();
                        flowsIn = null;
                        return [4 /*yield*/, this.helper.iamService.createInternalContext('processengine_system')];
                    case 6:
                        internalContext = _a.sent();
                        return [4 /*yield*/, flowDefEntityType.query(internalContext, {
                                query: [
                                    { attribute: 'target', operator: '=', value: nodeDef.id },
                                    { attribute: 'processDef', operator: '=', value: processDef.id }
                                ]
                            })];
                    case 7:
                        flowsIn = _a.sent();
                        if (!(flowsIn && flowsIn.length > 0)) return [3 /*break*/, 18];
                        ids = [];
                        i = 0;
                        _a.label = 8;
                    case 8:
                        if (!(i < flowsIn.data.length)) return [3 /*break*/, 11];
                        flow = flowsIn.data[i];
                        return [4 /*yield*/, flow.getSource];
                    case 9:
                        source_1 = _a.sent();
                        ids.push(source_1.id);
                        _a.label = 10;
                    case 10:
                        i++;
                        return [3 /*break*/, 8];
                    case 11:
                        queryIn = ids.map(function (id) {
                            return { attribute: 'id', operator: '=', value: id };
                        });
                        return [4 /*yield*/, nodeDefEntityType.query(internalContext, {
                                query: [
                                    { or: queryIn },
                                    { attribute: 'processDef', operator: '=', value: processDef.id }
                                ]
                            })];
                    case 12:
                        prevDefs = _a.sent();
                        keys_1 = [];
                        prevDefs.data.forEach(function (prefDev) {
                            keys_1.push(prefDev.key);
                        });
                        if (!source) return [3 /*break*/, 18];
                        return [4 /*yield*/, sourceEntityType.getById(source.id, internalContext)];
                    case 13:
                        sourceEnt = _a.sent();
                        return [4 /*yield*/, sourceEnt.getProcessToken];
                    case 14:
                        token = _a.sent();
                        allthere_1 = true;
                        return [4 /*yield*/, this.getProcessToken()];
                    case 15:
                        processToken = _a.sent();
                        tokenData_1 = processToken.data || {};
                        tokenData_1.history = tokenData_1.history || {};
                        merged = __assign({}, tokenData_1.history, token.data.history);
                        tokenData_1.history = merged;
                        processToken.data = tokenData_1;
                        return [4 /*yield*/, processToken.save(internalContext)];
                    case 16:
                        _a.sent();
                        keys_1.forEach(function (key) {
                            if (!tokenData_1.history.hasOwnProperty(key)) {
                                allthere_1 = false;
                            }
                        });
                        if (!allthere_1) return [3 /*break*/, 18];
                        return [4 /*yield*/, this.changeState(context, 'end', this)];
                    case 17:
                        _a.sent();
                        _a.label = 18;
                    case 18: return [2 /*return*/];
                }
            });
            if (flowsIn && flowsIn.length > 0) {
                const ids = [];
                for (let i = 0; i < flowsIn.entities.length; i++) {
                    const flow = flowsIn.entities[i];
                    const source = yield flow.getSource;
                    ids.push(source.id);
                }
                const queryIn = ids.map((id) => {
                    return { attribute: 'id', operator: '=', value: id };
                });
                prevDefs = yield nodeDefEntityType.query(internalContext, {
                    query: [
                        { or: queryIn },
                        { attribute: 'processDef', operator: '=', value: processDef.id }
                    ]
                });
                const keys = [];
                prevDefs.entities.forEach((prefDev) => {
                    keys.push(prefDev.key);
                });
                if (source) {
                    const sourceEntity = yield sourceEntityType.getById(source.id, internalContext);
                    const token = yield sourceEntity.getProcessToken();
                    let allthere = true;
                    const processToken = yield this.getProcessToken();
                    const tokenData = processToken.data || {};
                    tokenData.history = tokenData.history || {};
                    const merged = Object.assign({}, tokenData.history, token.data.history);
                    tokenData.history = merged;
                    processToken.data = tokenData;
                    yield processToken.save(internalContext);
                    keys.forEach((key) => {
                        if (!tokenData.history.hasOwnProperty(key)) {
                            allthere = false;
                        }
                    });
                    if (allthere) {
                        yield this.changeState(context, 'end', this);
                    }
                }
            }
        });
    }
}
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.string })
], ParallelGatewayEntity.prototype, "parallelType", null);
exports.ParallelGatewayEntity = ParallelGatewayEntity;

//# sourceMappingURL=parallel_gateway.js.map
