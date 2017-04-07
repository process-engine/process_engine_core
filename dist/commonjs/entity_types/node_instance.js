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
const debug = require("debug");
const debugInfo = debug('processengine:info');
const debugErr = debug('processengine:error');
class NodeInstanceEntityDependencyHelper {
    constructor(messageBusService, eventAggregator, iamService, nodeInstanceEntityTypeService) {
        this.messageBusService = undefined;
        this.eventAggregator = undefined;
        this.iamService = undefined;
        this.nodeInstanceEntityTypeService = undefined;
        this.messageBusService = messageBusService;
        this.eventAggregator = eventAggregator;
        this.iamService = iamService;
        this.nodeInstanceEntityTypeService = nodeInstanceEntityTypeService;
    }
}
exports.NodeInstanceEntityDependencyHelper = NodeInstanceEntityDependencyHelper;
let NodeInstanceEntity = class NodeInstanceEntity extends data_model_contracts_1.Entity {
    constructor(nodeInstanceEntityDependencyHelper, entityDependencyHelper, context, schema) {
        super(entityDependencyHelper, context, schema);
        this._nodeInstanceEntityDependencyHelper = undefined;
        this.messagebusSubscription = undefined;
        this.eventAggregatorSubscription = undefined;
        this._nodeInstanceEntityDependencyHelper = nodeInstanceEntityDependencyHelper;
    }
    get iamService() {
        return this._nodeInstanceEntityDependencyHelper.iamService;
    }
    get messageBusService() {
        return this._nodeInstanceEntityDependencyHelper.messageBusService;
    }
    get eventAggregator() {
        return this._nodeInstanceEntityDependencyHelper.eventAggregator;
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
        debugInfo(`start node, id ${this.id}, key ${this.key}, type ${this.type}`);
        let role = await this.getLaneRole(context);
        if (role !== null) {
        }
        if (!this.state) {
            this.state = 'start';
        }
        const internalContext = await this.iamService.createInternalContext('processengine_system');
        await this.save(internalContext);
        this.changeState(context, 'execute', this);
    }
    changeState(context, newState, source) {
        debugInfo(`change state of node, id ${this.id}, key ${this.key}, type ${this.type},  new state: ${newState}`);
        const data = {
            action: 'changeState',
            data: newState
        };
        const event = this.eventAggregator.createEntityEvent(data, source, context);
        this.eventAggregator.publish('/processengine/node/' + this.id, event);
    }
    error(context, error) {
        debugErr(`node error, id ${this.id}, key ${this.key}, type ${this.type}, ${error}`);
        const nodeDef = this.nodeDef;
        if (nodeDef && nodeDef.events && nodeDef.events.error) {
            const data = {
                action: 'event',
                event: 'error',
                data: error
            };
            const event = this.eventAggregator.createEntityEvent(data, this, context);
            this.eventAggregator.publish('/processengine/node/' + this.id, event);
        }
    }
    async execute(context) {
        debugInfo(`execute node, id ${this.id}, key ${this.key}, type ${this.type}`);
        const internalContext = await this.iamService.createInternalContext('processengine_system');
        this.state = 'progress';
        await this.save(internalContext);
        this.changeState(context, 'end', this);
    }
    async proceed(context, data, source, applicationId) {
    }
    async event(context, event, data) {
        debugInfo(`node event, id ${this.id}, key ${this.key}, type ${this.type}, event ${event}`);
        const nodeDefEntityType = await this.datastoreService.getEntityType('NodeDef');
        const internalContext = await this.iamService.createInternalContext('processengine_system');
        const nodeDef = this.nodeDef;
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
        debugInfo(`node cancel, id ${this.id}, key ${this.key}, type ${this.type}`);
        const nodeDef = this.nodeDef;
        if (nodeDef && nodeDef.events && nodeDef.events.cancel) {
            const data = {
                action: 'event',
                event: 'cancel',
                data: null
            };
            const msg = this.eventAggregator.createEntityEvent(data, this, context);
            this.eventAggregator.publish('/processengine/node/' + this.id, msg);
        }
    }
    async end(context, cancelFlow = false) {
        debugInfo(`end node, id ${this.id}, key ${this.key}, type ${this.type}`);
        const internalContext = await this.iamService.createInternalContext('processengine_system');
        this.state = 'end';
        await this.save(internalContext);
        const nodeInstance = this;
        const isEndEvent = (nodeInstance.type === 'bpmn:EndEvent');
        const processToken = await this.getProcessToken(internalContext);
        const tokenData = processToken.data || {};
        tokenData.history = tokenData.history || {};
        tokenData.history[this.key] = tokenData.current;
        processToken.data = tokenData;
        await processToken.save(internalContext);
        nodeInstance.eventAggregatorSubscription.dispose();
        nodeInstance.messagebusSubscription.cancel();
        if (!isEndEvent && !cancelFlow) {
            try {
                await this.nodeInstanceEntityTypeService.continueExecution(context, nodeInstance);
            }
            catch (err) {
                const process = await this.getProcess(internalContext);
                await process.error(context, err);
            }
        }
        else {
            const process = await this.getProcess(internalContext);
            await process.end(context, processToken);
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
