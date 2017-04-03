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
    constructor(iamService, nodeInstanceEntityTypeService, entityDependencyHelper, context, schema) {
        super(entityDependencyHelper, context, schema);
        this._iamService = undefined;
        this._nodeInstanceEntityTypeService = undefined;
        this._iamService = iamService;
        this._nodeInstanceEntityTypeService = nodeInstanceEntityTypeService;
    }
    get iamService() {
        return this._iamService;
    }
    get nodeInstanceEntityTypeService() {
        return this._nodeInstanceEntityTypeService;
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
        const NodeDef = await this.datastoreService.getEntityType('NodeDef');
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
        const queryObject = {
            operator: 'and',
            queries: [
                { attribute: 'type', operator: '=', value: 'bpmn:StartEvent' },
                { attribute: 'processDef', operator: '=', value: processDef.id }
            ]
        };
        const startEventDef = await NodeDef.findOne(internalContext, { query: queryObject });
        if (startEventDef) {
            const processToken = await ProcessToken.createEntity(internalContext);
            processToken.process = this;
            if (initialToken) {
                processToken.data = {
                    current: initialToken
                };
            }
            await processToken.save(internalContext);
            const startEvent = await this.nodeInstanceEntityTypeService.createNode(internalContext, StartEvent);
            startEvent.name = startEventDef.name;
            startEvent.key = startEventDef.key;
            startEvent.process = this;
            startEvent.nodeDef = startEventDef;
            startEvent.type = startEventDef.type;
            startEvent.processToken = processToken;
            startEvent.participant = participant;
            await startEvent.save(internalContext);
            await startEvent.changeState(laneContext, 'start', this);
        }
    }
    async end(context, processToken) {
        if (this.isSubProcess) {
            const callerId = this.callerId;
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
