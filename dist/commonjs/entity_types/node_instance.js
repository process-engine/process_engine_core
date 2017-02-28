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
const data_model_contracts_1 = require("@process-engine-js/data_model_contracts");
const metadata_1 = require("@process-engine-js/metadata");
class NodeInstanceEntityDependencyHelper {
    constructor(messageBusService, iamService, nodeInstanceEntityTypeService) {
        this.messageBusService = undefined;
        this.iamService = undefined;
        this.nodeInstanceEntityTypeService = undefined;
        this.messageBusService = messageBusService;
        this.iamService = iamService;
        this.nodeInstanceEntityTypeService = nodeInstanceEntityTypeService;
    }
}
exports.NodeInstanceEntityDependencyHelper = NodeInstanceEntityDependencyHelper;
let NodeInstanceEntity = class NodeInstanceEntity extends data_model_contracts_1.Entity {
    constructor(nodeInstanceEntityDependencyHelper, entityDependencyHelper) {
        super(entityDependencyHelper);
        this._nodeInstanceEntityDependencyHelper = undefined;
        this._nodeInstanceEntityDependencyHelper = nodeInstanceEntityDependencyHelper;
    }
    get iamService() {
        return this._nodeInstanceEntityDependencyHelper.iamService;
    }
    get messageBusService() {
        return this._nodeInstanceEntityDependencyHelper.messageBusService;
    }
    get nodeInstanceEntityTypeService() {
        return this._nodeInstanceEntityDependencyHelper.nodeInstanceEntityTypeService;
    }
    initialize(derivedClassInstance) {
        const _super = name => super[name];
        return __awaiter(this, void 0, void 0, function* () {
            const actualInstance = derivedClassInstance || this;
            yield _super("initialize").call(this, actualInstance);
        });
    }
    get name() {
        return this.getProperty(this, 'name');
    }
    set name(value) {
        this.setProperty(this, 'name', value);
    }
    get key() {
        return this.getProperty(this, 'key');
    }
    set key(value) {
        this.setProperty(this, 'key', value);
    }
    get process() {
        return this.getProperty(this, 'process');
    }
    set process(value) {
        this.setProperty(this, 'process', value);
    }
    getProcess() {
        return this.getPropertyLazy(this, 'process');
    }
    get nodeDef() {
        return this.getProperty(this, 'nodeDef');
    }
    set nodeDef(value) {
        this.setProperty(this, 'nodeDef', value);
    }
    getNodeDef() {
        return this.getPropertyLazy(this, 'nodeDef');
    }
    get type() {
        return this.getProperty(this, 'type');
    }
    set type(value) {
        this.setProperty(this, 'type', value);
    }
    get state() {
        return this.getProperty(this, 'state');
    }
    set state(value) {
        this.setProperty(this, 'state', value);
    }
    get participant() {
        return this.getProperty(this, 'participant');
    }
    set participant(value) {
        this.setProperty(this, 'participant', value);
    }
    get processToken() {
        return this.getProperty(this, 'processToken');
    }
    set processToken(value) {
        this.setProperty(this, 'processToken', value);
    }
    getProcessToken() {
        return this.getPropertyLazy(this, 'processToken');
    }
    getLaneRole(context) {
        return __awaiter(this, void 0, void 0, function* () {
            const nodeDef = yield this.getNodeDef();
            const role = yield nodeDef.getLaneRole(context);
            return role;
        });
    }
    start(context, source) {
        return __awaiter(this, void 0, void 0, function* () {
            let role = yield this.getLaneRole(context);
            if (role !== null) {
            }
            if (!this.state) {
                this.state = 'start';
            }
            const internalContext = yield this.iamService.createInternalContext('processengine_system');
            yield this.save(internalContext);
            yield this.changeState(context, 'execute', this);
        });
    }
    changeState(context, newState, source) {
        return __awaiter(this, void 0, void 0, function* () {
            const meta = {
                jwt: context.encryptedToken
            };
            const data = {
                action: 'changeState',
                data: newState
            };
            const origin = source.getEntityReference();
            const msg = this.messageBusService.createMessage(data, origin, meta);
            yield this.messageBusService.publish('/processengine/node/' + this.id, msg);
        });
    };
    NodeInstanceEntity.prototype.error = function (context, error) {
        return __awaiter(this, void 0, void 0, function () {
            var nodeDef, meta, data, origin, msg;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getNodeDef()];
                    case 1:
                        nodeDef = _a.sent();
                        if (!(nodeDef && nodeDef.events && nodeDef.events.error)) return [3 /*break*/, 3];
                        meta = {
                            jwt: context.encryptedToken
                        };
                        data = {
                            action: 'event',
                            event: 'error',
                            data: error
                        };
                        origin = this.getEntityReference();
                        msg = this.helper.messagebusService.createMessage(data, origin, meta);
                        return [4 /*yield*/, this.helper.messagebusService.publish('/processengine/node/' + this.id, msg)];
                    case 2:
                        _a.sent();
                        _a.label = 3;
                    case 3: return [2 /*return*/];
                }
            });
        });
    }
    execute(context) {
        return __awaiter(this, void 0, void 0, function* () {
            const internalContext = yield this.iamService.createInternalContext('processengine_system');
            this.state = 'progress';
            yield this.save(internalContext);
            yield this.changeState(context, 'end', this);
        });
    }
    proceed(context, data, source) {
        return __awaiter(this, void 0, void 0, function* () {
        });
    };
    NodeInstanceEntity.prototype.event = function (context, event, data) {
        return __awaiter(this, void 0, void 0, function () {
            var nodeDefEntityType, internalContext, nodeDef, boundaryDefKey, queryObject, boundary, token;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.helper.datastoreService.getEntityType('NodeDef')];
                    case 1:
                        nodeDefEntityType = _a.sent();
                        return [4 /*yield*/, this.helper.iamService.createInternalContext('processengine_system')];
                    case 2:
                        internalContext = _a.sent();
                        return [4 /*yield*/, this.getNodeDef()];
                    case 3:
                        nodeDef = _a.sent();
                        if (!(nodeDef && nodeDef.events && nodeDef.events[event])) return [3 /*break*/, 9];
                        boundaryDefKey = nodeDef.events[event];
                        queryObject = {
                            attribute: 'key', operator: '=', value: boundaryDefKey
                        };
                        return [4 /*yield*/, nodeDefEntityType.findOne(internalContext, { query: queryObject })];
                    case 4:
                        boundary = _a.sent();
                        return [4 /*yield*/, this.getProcessToken()];
                    case 5:
                        token = _a.sent();
                        if (!(boundary && boundary.cancelActivity)) return [3 /*break*/, 7];
                        return [4 /*yield*/, this.end(context, true)];
                    case 6:
                        _a.sent();
                        _a.label = 7;
                    case 7: return [4 /*yield*/, this.helper.nodeInstanceEntityTypeService.createNextNode(context, this, boundary, token)];
                    case 8:
                        _a.sent();
                        _a.label = 9;
                    case 9: return [2 /*return*/];
                }
                yield this.nodeInstanceEntityTypeService.createNextNode(context, this, boundary, token);
            }
        });
    };
    NodeInstanceEntity.prototype.cancel = function (context) {
        return __awaiter(this, void 0, void 0, function () {
            var nodeDef, meta, data, origin, msg;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getNodeDef()];
                    case 1:
                        nodeDef = _a.sent();
                        if (!(nodeDef && nodeDef.events && nodeDef.events.cancel)) return [3 /*break*/, 3];
                        meta = {
                            jwt: context.encryptedToken
                        };
                        data = {
                            action: 'event',
                            event: 'cancel',
                            data: null
                        };
                        origin = this.getEntityReference();
                        msg = this.helper.messagebusService.createMessage(data, origin, meta);
                        return [4 /*yield*/, this.helper.messagebusService.publish('/processengine/node/' + this.id, msg)];
                    case 2:
                        _a.sent();
                        _a.label = 3;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    NodeInstanceEntity.prototype.end = function (context, cancelFlow) {
        if (cancelFlow === void 0) { cancelFlow = false; }
        return __awaiter(this, void 0, void 0, function () {
            var flowDefEntityType, nodeDefEntityType, processTokenEntityType, internalContext, nodeInstance, splitToken, processToken, tokenData, nextDefs, nodeDef, processDef, flowsOut, queryIn, ids, i, flow, target, queryIn, i, nextDef, currentToken;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.helper.datastoreService.getEntityType('FlowDef')];
                    case 1:
                        flowDefEntityType = _a.sent();
                        return [4 /*yield*/, this.helper.datastoreService.getEntityType('NodeDef')];
                    case 2:
                        nodeDefEntityType = _a.sent();
                        return [4 /*yield*/, this.helper.datastoreService.getEntityType('ProcessToken')];
                    case 3:
                        processTokenEntityType = _a.sent();
                        return [4 /*yield*/, this.helper.iamService.createInternalContext('processengine_system')];
                    case 4:
                        internalContext = _a.sent();
                        this.state = 'end';
                        return [4 /*yield*/, this.save(internalContext)];
                    case 5:
                        _a.sent();
                        nodeInstance = this;
                        splitToken = (nodeInstance.type === 'bpmn:ParallelGateway' && nodeInstance.parallelType === 'split') ? true : false;
                        return [4 /*yield*/, this.getProcessToken()];
                    case 6:
                        processToken = _a.sent();
                        tokenData = processToken.data || {};
                        tokenData.history = tokenData.history || {};
                        tokenData.history[this.key] = tokenData.current;
                        processToken.data = tokenData;
                        return [4 /*yield*/, processToken.save(internalContext)];
                    case 7:
                        _a.sent();
                        nextDefs = null;
                        return [4 /*yield*/, this.getNodeDef()];
                    case 8:
                        nodeDef = _a.sent();
                        return [4 /*yield*/, nodeDef.getProcessDef()];
                    case 9:
                        processDef = _a.sent();
                        flowsOut = null;
                        if (!!cancelFlow) return [3 /*break*/, 27];
                        if (!nodeInstance.follow) return [3 /*break*/, 12];
                        if (!(nodeInstance.follow.length > 0)) return [3 /*break*/, 11];
                        queryIn = nodeInstance.follow.map(function (id) {
                            return { attribute: 'id', operator: '=', value: id };
                        });
                        flowsOut = yield flowDefEntityType.query(internalContext, {
                            query: [
                                { or: queryIn },
                                { attribute: 'processDef', operator: '=', value: processDef.id }
                            ]
                        })];
                    case 13:
                        flowsOut = _a.sent();
                        _a.label = 14;
                    case 14:
                        if (!(flowsOut && flowsOut.length > 0)) return [3 /*break*/, 27];
                        ids = [];
                        i = 0;
                        _a.label = 15;
                    case 15:
                        if (!(i < flowsOut.data.length)) return [3 /*break*/, 18];
                        flow = flowsOut.data[i];
                        return [4 /*yield*/, flow.target];
                    case 16:
                        target = _a.sent();
                        ids.push(target.id);
                        _a.label = 17;
                    case 17:
                        i++;
                        return [3 /*break*/, 15];
                    case 18:
                        queryIn = ids.map(function (id) {
                            return { attribute: 'id', operator: '=', value: id };
                        });
                        return [4 /*yield*/, nodeDefEntityType.query(internalContext, {
                                query: [
                                    { or: queryIn },
                                    { attribute: 'processDef', operator: '=', value: processDef.id }
                                ]
                            })];
                    case 19:
                        nextDefs = _a.sent();
                        if (!(nextDefs && nextDefs.length > 0)) return [3 /*break*/, 27];
                        i = 0;
                        _a.label = 20;
                    case 20:
                        if (!(i < nextDefs.data.length)) return [3 /*break*/, 27];
                        nextDef = nextDefs.data[i];
                        currentToken = void 0;
                        if (!(splitToken && i > 0)) return [3 /*break*/, 23];
                        return [4 /*yield*/, processTokenEntityType.createEntity(internalContext)];
                    case 21:
                        currentToken = _a.sent();
                        currentToken.process = processToken.process;
                        currentToken.data = processToken.data;
                        return [4 /*yield*/, currentToken.save(internalContext)];
                    case 22:
                        _a.sent();
                        return [3 /*break*/, 24];
                    case 23:
                        currentToken = processToken;
                        _a.label = 24;
                    case 24: return [4 /*yield*/, this.helper.nodeInstanceEntityTypeService.createNextNode(context, this, nextDef, currentToken)];
                    case 25:
                        _a.sent();
                        _a.label = 26;
                    case 26:
                        i++;
                        return [3 /*break*/, 20];
                    case 27: return [2 /*return*/];
                }
                else {
                    flowsOut = yield flowDefEntityType.query(internalContext, {
                        query: [
                            { attribute: 'source', operator: '=', value: nodeDef.id },
                            { attribute: 'processDef', operator: '=', value: processDef.id }
                        ]
                    });
                }
                if (flowsOut && flowsOut.length > 0) {
                    const ids = [];
                    for (let i = 0; i < flowsOut.data.length; i++) {
                        const flow = flowsOut.data[i];
                        const target = yield flow.target;
                        ids.push(target.id);
                    }
                    const queryIn = ids.map((id) => {
                        return { attribute: 'id', operator: '=', value: id };
                    });
                    nextDefs = yield nodeDefEntityType.query(internalContext, {
                        query: [
                            { or: queryIn },
                            { attribute: 'processDef', operator: '=', value: processDef.id }
                        ]
                    });
                    if (nextDefs && nextDefs.length > 0) {
                        for (let i = 0; i < nextDefs.data.length; i++) {
                            const nextDef = nextDefs.data[i];
                            let currentToken;
                            if (splitToken && i > 0) {
                                currentToken = yield processTokenEntityType.createEntity(internalContext);
                                currentToken.process = processToken.process;
                                currentToken.data = processToken.data;
                                yield currentToken.save(internalContext);
                            }
                            else {
                                currentToken = processToken;
                            }
                            yield this.nodeInstanceEntityTypeService.createNextNode(context, this, nextDef, currentToken);
                        }
                    }
                }
            }
        });
    }
};
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.string })
], NodeInstanceEntity.prototype, "name", null);
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.string })
], NodeInstanceEntity.prototype, "key", null);
__decorate([
    metadata_1.schemaAttribute({ type: 'Process' })
], NodeInstanceEntity.prototype, "process", null);
__decorate([
    metadata_1.schemaAttribute({ type: 'NodeDef' })
], NodeInstanceEntity.prototype, "nodeDef", null);
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.string })
], NodeInstanceEntity.prototype, "type", null);
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.string })
], NodeInstanceEntity.prototype, "state", null);
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.string })
], NodeInstanceEntity.prototype, "participant", null);
__decorate([
    metadata_1.schemaAttribute({ type: 'ProcessToken' })
], NodeInstanceEntity.prototype, "processToken", null);
NodeInstanceEntity = __decorate([
    metadata_1.schemaClass({
        expand: [
            { attribute: 'nodeDef', depth: 2 },
            { attribute: 'processToken', depth: 2 }
        ]
    })
], NodeInstanceEntity);
exports.NodeInstanceEntity = NodeInstanceEntity;

//# sourceMappingURL=node_instance.js.map
