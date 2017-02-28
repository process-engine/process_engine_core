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
class NodeInstanceEntityTypeService {
    constructor(datastoreService, messagebusService, iamService) {
        this._datastoreService = undefined;
        this._messagebusService = undefined;
        this._iamService = undefined;
        this._datastoreService = datastoreService;
        this._messagebusService = messagebusService;
        this._iamService = iamService;
    }
    get datastoreService() {
        return this._datastoreService;
    }
    get messagebusService() {
        return this._messagebusService;
    }
    get iamService() {
        return this._iamService;
    }
    createNode(context, entityType) {
        return __awaiter(this, void 0, void 0, function* () {
            function nodeHandler(msg) {
                return __awaiter(this, void 0, void 0, function () {
                    var action, source, context, newState, _a, newData, event_1, data;
                    return __generator(this, function (_b) {
                        switch (_b.label) {
                            case 0: return [4 /*yield*/, this.messagebus.verifyMessage(msg)];
                            case 1:
                                msg = _b.sent();
                                action = (msg && msg.data && msg.data.action) ? msg.data.action : null;
                                source = (msg && msg.origin) ? msg.origin : null;
                                context = (msg && msg.meta && msg.meta.context) ? msg.meta.context : {};
                                if (!(action === 'changeState')) return [3 /*break*/, 8];
                                newState = (msg && msg.data && msg.data.data) ? msg.data.data : null;
                                _a = newState;
                                switch (_a) {
                                    case ('start'): return [3 /*break*/, 2];
                                    case ('execute'): return [3 /*break*/, 4];
                                    case ('end'): return [3 /*break*/, 6];
                                }
                                return [3 /*break*/, 8];
                            case 2: return [4 /*yield*/, this.entity.start(context, source)];
                            case 3:
                                _b.sent();
                                return [3 /*break*/, 8];
                            case 4: return [4 /*yield*/, this.entity.execute(context)];
                            case 5:
                                _b.sent();
                                return [3 /*break*/, 8];
                            case 6: return [4 /*yield*/, this.entity.end(context)];
                            case 7:
                                _b.sent();
                                return [3 /*break*/, 8];
                            case 8:
                                if (!(action === 'proceed')) return [3 /*break*/, 10];
                                newData = (msg && msg.data && msg.data.token) ? msg.data.token : null;
                                return [4 /*yield*/, this.entity.proceed(context, newData, source)];
                            case 9:
                                _b.sent();
                                _b.label = 10;
                            case 10:
                                if (!(action === 'event')) return [3 /*break*/, 12];
                                event_1 = (msg && msg.data && msg.data.event) ? msg.data.event : null;
                                data = (msg && msg.data && msg.data.data) ? msg.data.data : null;
                                return [4 /*yield*/, this.entity.event(context, event_1, data)];
                            case 11:
                                _b.sent();
                                _b.label = 12;
                            case 12: return [2 /*return*/];
                        }
                    }
                    if (action === 'proceed') {
                        const newData = (msg && msg.data && msg.data.token) ? msg.data.token : null;
                        yield this.entity.proceed(context, newData, source);
                    }
                    if (action === 'event') {
                        const event = (msg && msg.data && msg.data.event) ? msg.data.event : null;
                        const data = (msg && msg.data && msg.data.data) ? msg.data.data : null;
                        yield this.entity.event(context, event, data);
                    }
                });
            }
            const internalContext = yield this.iamService.createInternalContext('processengine_system');
            const node = yield entityType.createEntity(internalContext);
            const binding = {
                entity: node,
                messagebus: this.messagebusService
            };
            yield this.messagebusService.subscribe('/processengine/node/' + node.id, nodeHandler.bind(binding));
            return node;
        });
    };
    NodeInstanceEntityTypeService.prototype.createNextNode = function (context, source, nextDef, token) {
        return __awaiter(this, void 0, void 0, function () {
            var process, participant, internalContext, forceCreateNode, map, className, entityType, currentDef, currentLane, nextLane, role, node, queryObj, meta, data, origin, msg;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, source.getProcess()];
                    case 1:
                        process = _a.sent();
                        participant = source.participant;
                        return [4 /*yield*/, this.iamService.createInternalContext('processengine_system')];
                    case 2:
                        internalContext = _a.sent();
                        forceCreateNode = (nextDef.type === 'bpmn:BoundaryEvent') ? true : false;
                        map = new Map();
                        map.set('bpmn:UserTask', 'UserTask');
                        map.set('bpmn:ExclusiveGateway', 'ExclusiveGateway');
                        map.set('bpmn:ParallelGateway', 'ParallelGateway');
                        map.set('bpmn:ServiceTask', 'ServiceTask');
                        map.set('bpmn:StartEvent', 'StartEvent');
                        map.set('bpmn:EndEvent', 'EndEvent');
                        map.set('bpmn:ScriptTask', 'ScriptTask');
                        map.set('bpmn:BoundaryEvent', 'BoundaryEvent');
                        map.set('bpmn:CallActivity', 'SubProcessExternal');
                        map.set('bpmn:SubProcess', 'SubProcessInternal');
                        className = map.get(nextDef.type);
                        return [4 /*yield*/, this.datastoreService.getEntityType(className)];
                    case 3:
                        entityType = _a.sent();
                        return [4 /*yield*/, source.getNodeDef()];
                    case 4:
                        currentDef = _a.sent();
                        return [4 /*yield*/, currentDef.getLane()];
                    case 5:
                        currentLane = _a.sent();
                        return [4 /*yield*/, nextDef.getLane()];
                    case 6:
                        nextLane = _a.sent();
                        if (!(currentLane && nextLane && currentLane.id !== nextLane.id)) return [3 /*break*/, 8];
                        return [4 /*yield*/, nextDef.getLaneRole(internalContext)];
                    case 7:
                        role = _a.sent();
                        if (role) {
                            participant = null;
                        }
                        _a.label = 8;
                    case 8:
                        node = null;
                        if (!!forceCreateNode) return [3 /*break*/, 10];
                        queryObj = [
                            { attribute: 'process', operator: '=', value: process.id },
                            { attribute: 'key', operator: '=', value: nextDef.key }
                        ];
                        return [4 /*yield*/, entityType.findOne(internalContext, { query: queryObj })];
                    case 9:
                        node = _a.sent();
                        _a.label = 10;
                    case 10:
                        if (!node) return [3 /*break*/, 12];
                        meta = {
                            jwt: context.encryptedToken
                        };
                        data = {
                            action: 'proceed',
                            token: null
                        };
                        origin = source.getEntityReference();
                        msg = this.messagebusService.createMessage(data, origin, meta);
                        return [4 /*yield*/, this.messagebusService.publish('/processengine/node/' + node.id, msg)];
                    case 11:
                        _a.sent();
                        return [3 /*break*/, 16];
                    case 12: return [4 /*yield*/, this.createNode(context, entityType)];
                    case 13:
                        node = _a.sent();
                        node.name = nextDef.name;
                        node.key = nextDef.key;
                        node.process = process;
                        node.nodeDef = nextDef;
                        node.type = nextDef.type;
                        node.processToken = token;
                        node.participant = participant;
                        return [4 /*yield*/, node.save(internalContext)];
                    case 14:
                        _a.sent();
                        return [4 /*yield*/, node.changeState(context, 'start', source)];
                    case 15:
                        _a.sent();
                        _a.label = 16;
                    case 16: return [2 /*return*/];
                }
            }
            let node = null;
            if (!forceCreateNode) {
                const queryObj = [
                    { attribute: 'process', operator: '=', value: process.id },
                    { attribute: 'key', operator: '=', value: nextDef.key }
                ];
                node = yield entityType.findOne(internalContext, { query: queryObj });
            }
            if (node) {
                const meta = {
                    jwt: context.encryptedToken
                };
                const data = {
                    action: 'proceed',
                    token: null
                };
                const origin = source.getEntityReference();
                const msg = this.messagebusService.createMessage(data, origin, meta);
                yield this.messagebusService.publish('/processengine/node/' + node.id, msg);
            }
            else {
                node = yield this.createNode(context, entityType);
                node.name = nextDef.name;
                node.key = nextDef.key;
                node.process = process;
                node.nodeDef = nextDef;
                node.type = nextDef.type;
                node.processToken = token;
                node.participant = participant;
                yield node.save(internalContext);
                yield node.changeState(context, 'start', source);
            }
        });
    }
}
exports.NodeInstanceEntityTypeService = NodeInstanceEntityTypeService;

//# sourceMappingURL=node_instance.js.map
