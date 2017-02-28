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
                return __awaiter(this, void 0, void 0, function* () {
                    msg = yield this.messagebus.verifyMessage(msg);
                    const action = (msg && msg.data && msg.data.action) ? msg.data.action : null;
                    const source = (msg && msg.origin) ? msg.origin : null;
                    const context = (msg && msg.meta && msg.meta.context) ? msg.meta.context : {};
                    if (action === 'changeState') {
                        const newState = (msg && msg.data && msg.data.data) ? msg.data.data : null;
                        switch (newState) {
                            case ('start'):
                                yield this.entity.start(context, source);
                                break;
                            case ('execute'):
                                yield this.entity.execute(context);
                                break;
                            case ('end'):
                                yield this.entity.end(context);
                                break;
                            default:
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
    }
    createNextNode(context, source, nextDef, token) {
        return __awaiter(this, void 0, void 0, function* () {
            const process = yield source.getProcess();
            let participant = source.participant;
            const internalContext = yield this.iamService.createInternalContext('processengine_system');
            const forceCreateNode = (nextDef.type === 'bpmn:BoundaryEvent') ? true : false;
            const map = new Map();
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
            const className = map.get(nextDef.type);
            const entityType = yield this.datastoreService.getEntityType(className);
            const currentDef = yield source.getNodeDef();
            const currentLane = yield currentDef.getLane();
            const nextLane = yield nextDef.getLane();
            if (currentLane && nextLane && currentLane.id !== nextLane.id) {
                const role = yield nextDef.getLaneRole(internalContext);
                if (role) {
                    participant = null;
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
