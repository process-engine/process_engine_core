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
    constructor(messageBusService, eventAggregator, iamService, nodeInstanceEntityTypeService, processEngineService, timingService) {
        this.messageBusService = undefined;
        this.eventAggregator = undefined;
        this.iamService = undefined;
        this.nodeInstanceEntityTypeService = undefined;
        this.processEngineService = undefined;
        this.timingService = undefined;
        this.messageBusService = messageBusService;
        this.eventAggregator = eventAggregator;
        this.iamService = iamService;
        this.nodeInstanceEntityTypeService = nodeInstanceEntityTypeService;
        this.processEngineService = processEngineService;
        this.timingService = timingService;
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
    get processEngineService() {
        return this._nodeInstanceEntityDependencyHelper.processEngineService;
    }
    get timingService() {
        return this._nodeInstanceEntityDependencyHelper.timingService;
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
    get instanceCounter() {
        return this.getProperty(this, 'instanceCounter');
    }
    set instanceCounter(value) {
        this.setProperty(this, 'instanceCounter', value);
    }
    async getLaneRole(context) {
        const nodeDef = this.nodeDef;
        const role = await nodeDef.getLaneRole(context);
        return role;
    }
    async start(context, source) {
        debugInfo(`start node, id ${this.id}, key ${this.key}, type ${this.type}`);
        let role = await this.nodeDef.lane.role;
        if (role !== null) {
        }
        if (!this.state) {
            this.state = 'start';
        }
        this.process.addActiveInstance(this);
        const processToken = this.processToken;
        for (let i = 0; i < this.process.processDef.nodeDefCollection.data.length; i++) {
            const boundary = this.process.processDef.nodeDefCollection.data[i];
            if (boundary.attachedToNode && boundary.attachedToNode.id === this.nodeDef.id) {
                if (boundary.eventType === 'bpmn:TimerEventDefinition' || boundary.eventType === 'bpmn:MessageEventDefinition' || boundary.eventType === 'bpmn:SignalEventDefinition') {
                    await this.nodeInstanceEntityTypeService.createNextNode(context, this, boundary, processToken);
                }
            }
        }
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
    async wait(context) {
        debugInfo(`execute node, id ${this.id}, key ${this.key}, type ${this.type}`);
        const internalContext = await this.iamService.createInternalContext('processengine_system');
        this.state = 'wait';
        await this.save(internalContext);
    }
    async execute(context) {
        debugInfo(`execute node, id ${this.id}, key ${this.key}, type ${this.type}`);
        this.state = 'progress';
        this.changeState(context, 'end', this);
    }
    async proceed(context, data, source, applicationId) {
    }
    async event(context, event, data, source, applicationId) {
        debugInfo(`node event, id ${this.id}, key ${this.key}, type ${this.type}, event ${event}`);
        const boundaryEventEntityType = await this.datastoreService.getEntityType('BoundaryEvent');
        const nodeDefEntityType = await this.datastoreService.getEntityType('NodeDef');
        const internalContext = await this.iamService.createInternalContext('processengine_system');
        const nodeDef = this.nodeDef;
        if (nodeDef && nodeDef.events) {
            const events = nodeDef.events.filter((el) => {
                return el.type === event;
            });
            const processToken = await this.getProcessToken(internalContext);
            const tokenData = processToken.data || {};
            const process = await this.getProcess(internalContext);
            for (let i = 0; i < events.length; i++) {
                const boundaryId = events[i].boundary;
                const boundaryDef = await nodeDefEntityType.getById(boundaryId, internalContext);
                const queryObj = {
                    operator: 'and',
                    queries: [
                        { attribute: 'key', operator: '=', value: boundaryDef.key },
                        { attribute: 'process', operator: '=', value: process.id }
                    ]
                };
                const boundary = await boundaryEventEntityType.findOne(internalContext, { query: queryObj });
                if (boundaryDef) {
                    switch (event) {
                        case 'error':
                            await this.end(context, true);
                            break;
                        case 'timer':
                            boundary.changeState(context, 'end', this);
                            if (boundaryDef.cancelActivity) {
                                await this.end(internalContext, true);
                            }
                            break;
                        case 'signal':
                            break;
                        case 'message':
                            break;
                        case 'cancel':
                            break;
                        case 'condition':
                            if (boundaryDef.condition) {
                                const functionString = 'return ' + boundaryDef.condition;
                                const evaluateFunction = new Function('token', functionString);
                                tokenData.current = data;
                                let result;
                                try {
                                    result = evaluateFunction.call(tokenData, tokenData);
                                }
                                catch (err) {
                                    debugErr(`error evaluating condition '${boundaryDef.condition}', key ${boundaryDef.key}`);
                                }
                                if (result) {
                                    await this.nodeInstanceEntityTypeService.createNextNode(context, this, boundaryDef, processToken);
                                    if (boundaryDef.cancelActivity) {
                                        await this.end(internalContext, true);
                                    }
                                }
                            }
                            break;
                        default:
                    }
                }
            }
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
        this.process.removeActiveInstance(this);
        const nodeInstance = this;
        const isEndEvent = (nodeInstance.type === 'bpmn:EndEvent');
        const processToken = this.processToken;
        const tokenData = processToken.data || {};
        const nodeDef = this.nodeDef;
        const mapper = nodeDef.mapper;
        if (mapper !== undefined) {
            const newCurrent = (new Function('token', 'return ' + mapper)).call(tokenData, tokenData);
            tokenData.current = newCurrent;
        }
        tokenData.history = tokenData.history || {};
        if (tokenData.history.hasOwnProperty(this.key) || this.instanceCounter > 0) {
            if (this.instanceCounter === 1) {
                const arr = [];
                arr.push(tokenData.history[this.key]);
                arr.push(tokenData.current);
                tokenData.history[this.key] = arr;
            }
            else {
                tokenData.history[this.key].push(tokenData.current);
            }
        }
        else {
            tokenData.history[this.key] = tokenData.current;
        }
        processToken.data = tokenData;
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
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.number })
], NodeInstanceEntity.prototype, "instanceCounter", null);
NodeInstanceEntity = __decorate([
    metadata_1.schemaClass({
        expandEntity: [
            { attribute: 'nodeDef' }
        ]
    })
], NodeInstanceEntity);
exports.NodeInstanceEntity = NodeInstanceEntity;

//# sourceMappingURL=node_instance.js.map
