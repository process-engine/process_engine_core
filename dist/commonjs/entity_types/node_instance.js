"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
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
    async initialize(derivedClassInstance) {
        const actualInstance = derivedClassInstance || this;
        await super.initialize(actualInstance);
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
    getProcess(context) {
        return this.getPropertyLazy(this, 'process', context);
    }
    get nodeDef() {
        return this.getProperty(this, 'nodeDef');
    }
    set nodeDef(value) {
        this.setProperty(this, 'nodeDef', value);
    }
    getNodeDef(context) {
        return this.getPropertyLazy(this, 'nodeDef', context);
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
    getProcessToken(context) {
        return this.getPropertyLazy(this, 'processToken', context);
    }
    async getLaneRole(context) {
        const nodeDef = await this.getNodeDef(context);
        const role = await nodeDef.getLaneRole(context);
        return role;
    }
    async start(context, source) {
        // check if context matches to lane
        let role = await this.getLaneRole(context);
        if (role !== null) {
            // Todo: refactor check if user has lane role
            // const permissions = {
            //   'execute': [role]
            // };
            // await context.checkPermissions(this.id + '.execute', permissions);
        }
        if (!this.state) {
            this.state = 'start';
        }
        const internalContext = await this.iamService.createInternalContext('processengine_system');
        await this.save(internalContext);
        await this.changeState(context, 'execute', this);
    }
    async changeState(context, newState, source) {
        const meta = {
            jwt: context.encryptedToken
        };
        const data = {
            action: 'changeState',
            data: newState
        };
        // Todo: 
        const origin = source.getEntityReference();
        const msg = this.messageBusService.createMessage(data, origin, meta);
        await this.messageBusService.publish('/processengine/node/' + this.id, msg);
    }
    async error(context, error) {
        const nodeDef = await this.getNodeDef(context);
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
            await this.messageBusService.publish('/processengine/node/' + this.id, msg);
        }
    }
    async execute(context) {
        const internalContext = await this.iamService.createInternalContext('processengine_system');
        this.state = 'progress';
        await this.save(internalContext);
        await this.changeState(context, 'end', this);
    }
    async proceed(context, data, source) {
        // by default do nothing, implementation should be overwritten by child class
    }
    async event(context, event, data) {
        const nodeDefEntityType = await this.datastoreService.getEntityType('NodeDef');
        const internalContext = await this.iamService.createInternalContext('processengine_system');
        // check if definition exists
        const nodeDef = await this.getNodeDef(internalContext);
        if (nodeDef && nodeDef.events && nodeDef.events[event]) {
            const boundaryDefKey = nodeDef.events[event];
            const queryObject = {
                attribute: 'key', operator: '=', value: boundaryDefKey
            };
            const boundary = await nodeDefEntityType.findOne(internalContext, { query: queryObject });
            const token = await this.getProcessToken(internalContext);
            if (boundary && boundary.cancelActivity) {
                await this.end(context, true);
            }
            await this.nodeInstanceEntityTypeService.createNextNode(context, this, boundary, token);
        }
    }
    async cancel(context) {
        const nodeDef = await this.getNodeDef(context);
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
            await this.messageBusService.publish('/processengine/node/' + this.id, msg);
        }
    }
    async end(context, cancelFlow = false) {
        const flowDefEntityType = await this.datastoreService.getEntityType('FlowDef');
        const nodeDefEntityType = await this.datastoreService.getEntityType('NodeDef');
        const processTokenEntityType = await this.datastoreService.getEntityType('ProcessToken');
        const internalContext = await this.iamService.createInternalContext('processengine_system');
        this.state = 'end';
        await this.save(internalContext);
        const nodeInstance = this;
        const splitToken = (nodeInstance.type === 'bpmn:ParallelGateway' && nodeInstance.parallelType === 'split') ? true : false;
        const processToken = await this.getProcessToken(internalContext);
        const tokenData = processToken.data || {};
        tokenData.history = tokenData.history || {};
        tokenData.history[this.key] = tokenData.current;
        processToken.data = tokenData;
        await processToken.save(internalContext);
        let nextDefs = null;
        const nodeDef = await this.getNodeDef(internalContext);
        const processDef = await nodeDef.getProcessDef(internalContext);
        let flowsOut = null;
        if (!cancelFlow) {
            if (nodeInstance.follow) {
                // we have already a list of flows to follow
                if (nodeInstance.follow.length > 0) {
                    const queryObjectFollow = {
                        operator: 'and',
                        queries: [
                            { attribute: 'id', operator: 'in', value: nodeInstance.follow },
                            { attribute: 'processDef', operator: '=', value: processDef.id }
                        ]
                    };
                    flowsOut = await flowDefEntityType.query(internalContext, { query: queryObjectFollow });
                }
            }
            else {
                // query for all flows going out
                const queryObjectAll = {
                    operator: 'and',
                    queries: [
                        { attribute: 'source', operator: '=', value: nodeDef.id },
                        { attribute: 'processDef', operator: '=', value: processDef.id }
                    ]
                };
                flowsOut = await flowDefEntityType.query(internalContext, { query: queryObjectAll });
            }
            if (flowsOut && flowsOut.length > 0) {
                const ids = [];
                for (let i = 0; i < flowsOut.data.length; i++) {
                    const flow = flowsOut.data[i];
                    const target = await flow.target;
                    ids.push(target.id);
                }
                const queryObjectIn = {
                    operator: 'and',
                    queries: [
                        { attribute: 'id', operator: 'in', value: ids },
                        { attribute: 'processDef', operator: '=', value: processDef.id }
                    ]
                };
                nextDefs = await nodeDefEntityType.query(internalContext, { query: queryObjectIn });
                if (nextDefs && nextDefs.length > 0) {
                    for (let i = 0; i < nextDefs.data.length; i++) {
                        const nextDef = nextDefs.data[i];
                        let currentToken;
                        if (splitToken && i > 0) {
                            currentToken = await processTokenEntityType.createEntity(internalContext);
                            currentToken.process = processToken.process;
                            currentToken.data = processToken.data;
                            await currentToken.save(internalContext);
                        }
                        else {
                            currentToken = processToken;
                        }
                        await this.nodeInstanceEntityTypeService.createNextNode(context, this, nextDef, currentToken);
                    }
                }
            }
        }
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
        expandEntity: [
            { attribute: 'nodeDef' },
            { attribute: 'processToken' }
        ]
    })
], NodeInstanceEntity);
exports.NodeInstanceEntity = NodeInstanceEntity;

//# sourceMappingURL=node_instance.js.map
