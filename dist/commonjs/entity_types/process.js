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
class ProcessEntity extends data_model_contracts_1.Entity {
    constructor(iamService, nodeInstanceEntityTypeService, messageBusService, entityDependencyHelper, context, schema) {
        super(entityDependencyHelper, context, schema);
        this._iamService = undefined;
        this._nodeInstanceEntityTypeService = undefined;
        this._messageBusService = undefined;
        this._activeInstances = {};
        this._iamService = iamService;
        this._nodeInstanceEntityTypeService = nodeInstanceEntityTypeService;
        this._messageBusService = messageBusService;
    }
    get iamService() {
        return this._iamService;
    }
    get nodeInstanceEntityTypeService() {
        return this._nodeInstanceEntityTypeService;
    }
    get messageBusService() {
        return this._messageBusService;
    }
    async initialize(derivedClassInstance) {
        const actualInstance = derivedClassInstance || this;
        await super.initialize(actualInstance);
    }
    get activeInstances() {
        return this._activeInstances;
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
    get processDef() {
        return this.getProperty(this, 'processDef');
    }
    set processDef(value) {
        this.setProperty(this, 'processDef', value);
    }
    getProcessDef(context) {
        return this.getPropertyLazy(this, 'processDef', context);
    }
    get isSubProcess() {
        return this.getProperty(this, 'isSubProcess');
    }
    set isSubProcess(value) {
        this.setProperty(this, 'isSubProcess', value);
    }
    get callerId() {
        return this.getProperty(this, 'callerId');
    }
    set callerId(value) {
        this.setProperty(this, 'callerId', value);
    }
    async start(context, params, options) {
        const source = params ? params.source : undefined;
        const isSubProcess = params ? params.isSubProcess : false;
        const initialToken = params ? params.initialToken : undefined;
        const ProcessToken = await this.datastoreService.getEntityType('ProcessToken');
        const StartEvent = await this.datastoreService.getEntityType('StartEvent');
        const internalContext = await this.iamService.createInternalContext('processengine_system');
        let laneContext = context;
        let participant = null;
        this.isSubProcess = isSubProcess;
        this.callerId = (isSubProcess && source) ? source.id : null;
        await this.save(internalContext);
        if (!isSubProcess) {
            participant = source || null;
        }
        const processDef = await this.getProcessDef(internalContext);
        await processDef.getNodeDefCollection(internalContext);
        await processDef.nodeDefCollection.each(internalContext, async (nodeDef) => {
            nodeDef.processDef = processDef;
        });
        await processDef.getFlowDefCollection(internalContext);
        await processDef.flowDefCollection.each(internalContext, async (flowDef) => {
            flowDef.processDef = processDef;
        });
        await processDef.getLaneCollection(internalContext);
        await processDef.laneCollection.each(internalContext, async (lane) => {
            lane.processDef = processDef;
        });
        let startEventDef = undefined;
        for (let i = 0; i < processDef.nodeDefCollection.length; i++) {
            const nodeDef = processDef.nodeDefCollection.data[i];
            if (nodeDef.lane) {
                const laneId = nodeDef.lane.id;
                for (let j = 0; j < processDef.laneCollection.length; j++) {
                    const lane = processDef.laneCollection.data[j];
                    if (lane.id === laneId) {
                        nodeDef.lane = lane;
                    }
                }
            }
            if (nodeDef.type === 'bpmn:StartEvent') {
                startEventDef = nodeDef;
            }
        }
        if (startEventDef) {
            const processToken = await ProcessToken.createEntity(internalContext);
            processToken.process = this;
            if (initialToken) {
                processToken.data = {
                    current: initialToken
                };
            }
            const startEvent = await this.nodeInstanceEntityTypeService.createNode(internalContext, StartEvent);
            startEvent.name = startEventDef.name;
            startEvent.key = startEventDef.key;
            startEvent.process = this;
            startEvent.nodeDef = startEventDef;
            startEvent.type = startEventDef.type;
            startEvent.processToken = processToken;
            startEvent.participant = participant;
            startEvent.changeState(laneContext, 'start', this);
        }
    }
    async end(context, processToken) {
        if (this.isSubProcess) {
            const callerId = this.callerId;
            const source = this;
            const data = {
                action: 'proceed',
                token: processToken.data
            };
            const msg = this.messageBusService.createEntityMessage(data, source, context);
            const channel = '/processengine/node/' + callerId;
            await this.messageBusService.publish(channel, msg);
        }
    }
    async error(context, error) {
        const processToken = null;
        if (this.isSubProcess) {
            const callerId = this.callerId;
            const source = this.getEntityReference().toPojo();
            const data = {
                action: 'event',
                event: 'error',
                data: error
            };
            const msg = this.messageBusService.createEntityMessage(data, source, context);
            const channel = '/processengine/node/' + callerId;
            await this.messageBusService.publish(channel, msg);
        }
        await this.end(context, processToken);
    }
    addActiveInstance(entity) {
        this._activeInstances[entity.id] = entity;
    }
    removeActiveInstance(entity) {
        if (this._activeInstances.hasOwnProperty(entity.id)) {
            delete this._activeInstances[entity.id];
        }
    }
}
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.string })
], ProcessEntity.prototype, "name", null);
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.string })
], ProcessEntity.prototype, "key", null);
__decorate([
    metadata_1.schemaAttribute({ type: 'ProcessDef' })
], ProcessEntity.prototype, "processDef", null);
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.boolean })
], ProcessEntity.prototype, "isSubProcess", null);
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.string })
], ProcessEntity.prototype, "callerId", null);
exports.ProcessEntity = ProcessEntity;

//# sourceMappingURL=process.js.map
