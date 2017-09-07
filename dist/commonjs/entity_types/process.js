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
class ProcessEntity extends data_model_contracts_1.Entity {
    constructor(iamService, nodeInstanceEntityTypeService, messageBusService, processEngineService, entityDependencyHelper, context, schema, propertyBag, entityType) {
        super(entityDependencyHelper, context, schema, propertyBag, entityType);
        this._iamService = undefined;
        this._nodeInstanceEntityTypeService = undefined;
        this._messageBusService = undefined;
        this._processEngineService = undefined;
        this._activeInstances = {};
        this._allInstances = {};
        this.boundProcesses = {};
        this._iamService = iamService;
        this._nodeInstanceEntityTypeService = nodeInstanceEntityTypeService;
        this._messageBusService = messageBusService;
        this._processEngineService = processEngineService;
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
    get processEngineService() {
        return this._processEngineService;
    }
    async initialize() {
        await super.initialize(this);
    }
    get activeInstances() {
        return this._activeInstances;
    }
    get allInstances() {
        return this._allInstances;
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
    get status() {
        return this.getProperty(this, 'status');
    }
    set status(value) {
        this.setProperty(this, 'status', value);
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
        const participant = params ? params.participant : null;
        const datastoreService = await this.getDatastoreService();
        const processTokenType = await datastoreService.getEntityType('ProcessToken');
        const startEventType = await datastoreService.getEntityType('StartEvent');
        const internalContext = await this.iamService.createInternalContext('processengine_system');
        let laneContext = context;
        let applicationId = null;
        this.isSubProcess = isSubProcess;
        this.callerId = (isSubProcess && source) ? source.id : null;
        this.status = 'progress';
        if (this.processDef.persist) {
            await this.save(internalContext, { reloadAfterSave: false });
        }
        if (!isSubProcess) {
            applicationId = source || null;
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
            const processToken = await processTokenType.createEntity(internalContext);
            processToken.process = this;
            if (initialToken) {
                processToken.data = {
                    current: initialToken
                };
            }
            if (this.processDef.persist) {
                await processToken.save(internalContext, { reloadAfterSave: false });
            }
            this.processEngineService.addActiveInstance(this);
            debugInfo(`process id ${this.id} started: `);
            const startEvent = await this.nodeInstanceEntityTypeService.createNode(internalContext, startEventType);
            startEvent.name = startEventDef.name;
            startEvent.key = startEventDef.key;
            startEvent.process = this;
            startEvent.nodeDef = startEventDef;
            startEvent.type = startEventDef.type;
            startEvent.processToken = processToken;
            startEvent.participant = participant;
            startEvent.application = applicationId;
            startEvent.changeState(laneContext, 'start', this);
        }
    }
    async end(context, processToken) {
        if (this.processDef.persist) {
            this.status = 'end';
        }
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
        else {
            Object.keys(this.boundProcesses).forEach((id) => {
                this.processEngineService.removeActiveInstance(this.boundProcesses[id]);
            });
            this.processEngineService.removeActiveInstance(this);
        }
    }
    async error(context, error) {
        const processToken = null;
        if (this.isSubProcess) {
            const callerId = this.callerId;
            const source = this;
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
        this._allInstances[entity.id] = entity;
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
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.string })
], ProcessEntity.prototype, "status", null);
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
