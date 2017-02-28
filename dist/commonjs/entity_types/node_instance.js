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
    constructor(nodeInstanceEntityDependencyHelper, entityDependencyHelper, context, schema) {
        super(entityDependencyHelper, context, schema);
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
    }
    error(context, error) {
        return __awaiter(this, void 0, void 0, function* () {
            const nodeDef = yield this.getNodeDef();
            if (nodeDef && nodeDef.events && nodeDef.events.error) {
                const meta = {
                    jwt: context.encryptedToken
                };
                const data = {
                    action: 'event',
                    event: 'error',
                    data: error
                };
                const origin = this.getEntityReference();
                const msg = this.messageBusService.createMessage(data, origin, meta);
                yield this.messageBusService.publish('/processengine/node/' + this.id, msg);
            }
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
    }
    event(context, event, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const nodeDefEntityType = yield this.datastoreService.getEntityType('NodeDef');
            const internalContext = yield this.iamService.createInternalContext('processengine_system');
            const nodeDef = yield this.getNodeDef();
            if (nodeDef && nodeDef.events && nodeDef.events[event]) {
                const boundaryDefKey = nodeDef.events[event];
                const queryObject = {
                    attribute: 'key', operator: '=', value: boundaryDefKey
                };
                const boundary = yield nodeDefEntityType.findOne(internalContext, { query: queryObject });
                const token = yield this.getProcessToken();
                if (boundary && boundary.cancelActivity) {
                    yield this.end(context, true);
                }
                yield this.nodeInstanceEntityTypeService.createNextNode(context, this, boundary, token);
            }
        });
    }
    cancel(context) {
        return __awaiter(this, void 0, void 0, function* () {
            const nodeDef = yield this.getNodeDef();
            if (nodeDef && nodeDef.events && nodeDef.events.cancel) {
                const meta = {
                    jwt: context.encryptedToken
                };
                const data = {
                    action: 'event',
                    event: 'cancel',
                    data: null
                };
                const origin = this.getEntityReference();
                const msg = this.messageBusService.createMessage(data, origin, meta);
                yield this.messageBusService.publish('/processengine/node/' + this.id, msg);
            }
        });
    }
    end(context, cancelFlow = false) {
        return __awaiter(this, void 0, void 0, function* () {
            const flowDefEntityType = yield this.datastoreService.getEntityType('FlowDef');
            const nodeDefEntityType = yield this.datastoreService.getEntityType('NodeDef');
            const processTokenEntityType = yield this.datastoreService.getEntityType('ProcessToken');
            const internalContext = yield this.iamService.createInternalContext('processengine_system');
            this.state = 'end';
            yield this.save(internalContext);
            const nodeInstance = this;
            const splitToken = (nodeInstance.type === 'bpmn:ParallelGateway' && nodeInstance.parallelType === 'split') ? true : false;
            const processToken = yield this.getProcessToken();
            const tokenData = processToken.data || {};
            tokenData.history = tokenData.history || {};
            tokenData.history[this.key] = tokenData.current;
            processToken.data = tokenData;
            yield processToken.save(internalContext);
            let nextDefs = null;
            const nodeDef = yield this.getNodeDef();
            const processDef = yield nodeDef.getProcessDef();
            let flowsOut = null;
            if (!cancelFlow) {
                if (nodeInstance.follow) {
                    if (nodeInstance.follow.length > 0) {
                        const queryIn = nodeInstance.follow.map((id) => {
                            return { attribute: 'id', operator: '=', value: id };
                        });
                        flowsOut = yield flowDefEntityType.query(internalContext, {
                            query: [
                                { or: queryIn },
                                { attribute: 'processDef', operator: '=', value: processDef.id }
                            ]
                        });
                    }
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
