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
class NodeDefEntity extends data_model_contracts_1.Entity {
    constructor(entityDependencyHelper, context, schema, propertyBag) {
        super(entityDependencyHelper, context, schema, propertyBag);
    }
    async initialize() {
        await super.initialize(this);
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
    get lane() {
        return this.getProperty(this, 'lane');
    }
    set lane(value) {
        this.setProperty(this, 'lane', value);
    }
    getLane(context) {
        return this.getPropertyLazy(this, 'lane', context);
    }
    get type() {
        return this.getProperty(this, 'type');
    }
    set type(value) {
        this.setProperty(this, 'type', value);
    }
    get extensions() {
        return this.getProperty(this, 'extensions');
    }
    set extensions(value) {
        this.setProperty(this, 'extensions', value);
    }
    get attachedToNode() {
        return this.getProperty(this, 'attachedToNode');
    }
    set attachedToNode(value) {
        this.setProperty(this, 'attachedToNode', value);
    }
    getAttachedToNode(context) {
        return this.getPropertyLazy(this, 'attachedToNode', context);
    }
    get events() {
        return this.getProperty(this, 'events');
    }
    set events(value) {
        this.setProperty(this, 'events', value);
    }
    get script() {
        return this.getProperty(this, 'script');
    }
    set script(value) {
        this.setProperty(this, 'script', value);
    }
    get eventType() {
        return this.getProperty(this, 'eventType');
    }
    set eventType(value) {
        this.setProperty(this, 'eventType', value);
    }
    get cancelActivity() {
        return this.getProperty(this, 'cancelActivity');
    }
    set cancelActivity(value) {
        this.setProperty(this, 'cancelActivity', value);
    }
    get subProcessKey() {
        return this.getProperty(this, 'subProcessKey');
    }
    set subProcessKey(value) {
        this.setProperty(this, 'subProcessKey', value);
    }
    get subProcessDef() {
        return this.getProperty(this, 'subProcessDef');
    }
    set subProcessDef(value) {
        this.setProperty(this, 'subProcessDef', value);
    }
    getSubProcessDef(context) {
        return this.getPropertyLazy(this, 'subProcessDef', context);
    }
    get counter() {
        return this.getProperty(this, 'counter');
    }
    set counter(value) {
        this.setProperty(this, 'counter', value);
    }
    get timerDefinitionType() {
        return this.getProperty(this, 'timerDefinitionType');
    }
    set timerDefinitionType(value) {
        this.setProperty(this, 'timerDefinitionType', value);
    }
    get timerDefinition() {
        return this.getProperty(this, 'timerDefinition');
    }
    set timerDefinition(value) {
        this.setProperty(this, 'timerDefinition', value);
    }
    get startContext() {
        return this.getProperty(this, 'startContext');
    }
    set startContext(value) {
        this.setProperty(this, 'startContext', value);
    }
    get startContextEntityType() {
        return this.getProperty(this, 'startContextEntityType');
    }
    set startContextEntityType(value) {
        this.setProperty(this, 'startContextEntityType', value);
    }
    get signal() {
        return this.getProperty(this, 'signal');
    }
    set signal(value) {
        this.setProperty(this, 'signal', value);
    }
    get message() {
        return this.getProperty(this, 'message');
    }
    set message(value) {
        this.setProperty(this, 'message', value);
    }
    get condition() {
        return this.getProperty(this, 'condition');
    }
    set condition(value) {
        this.setProperty(this, 'condition', value);
    }
    get errorName() {
        return this.getProperty(this, 'errorName');
    }
    set errorName(value) {
        this.setProperty(this, 'errorName', value);
    }
    get errorCode() {
        return this.getProperty(this, 'errorCode');
    }
    set errorCode(value) {
        this.setProperty(this, 'errorCode', value);
    }
    get features() {
        return this._extractFeatures();
    }
    async getLaneRole(context) {
        const lane = await this.getLane(context);
        return lane.role;
    }
    async getBoundaryEvents(context) {
        const nodeDefEntityType = await (await this.getDatastoreService()).getEntityType('NodeDef');
        const queryObject = {
            attribute: 'attachedToNode',
            operator: '=',
            value: this.id
        };
        const boundaryColl = await nodeDefEntityType.query(context, { query: queryObject });
        return boundaryColl;
    }
    _extractFeatures() {
        let features = undefined;
        const extensions = this.extensions || null;
        const props = (extensions && extensions.properties) ? extensions.properties : null;
        if (props) {
            props.forEach((prop) => {
                if (prop.name === 'features') {
                    features = JSON.parse(prop.value);
                }
            });
        }
        if (this.type === 'bpmn:UserTask') {
            features = features || [];
            features.push({ name: 'UI', value: true });
        }
        return features;
    }
    get mapper() {
        return this._extractMapper();
    }
    _extractMapper() {
        let mapper = undefined;
        const extensions = this.extensions || undefined;
        const props = (extensions !== undefined && extensions.properties) ? extensions.properties : undefined;
        if (props !== undefined) {
            props.forEach((prop) => {
                if (prop.name === 'mapper') {
                    mapper = prop.value;
                }
            });
        }
        return mapper;
    }
    get persist() {
        return true;
    }
}
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.string })
], NodeDefEntity.prototype, "name", null);
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.string })
], NodeDefEntity.prototype, "key", null);
__decorate([
    metadata_1.schemaAttribute({ type: 'ProcessDef' })
], NodeDefEntity.prototype, "processDef", null);
__decorate([
    metadata_1.schemaAttribute({ type: 'Lane' })
], NodeDefEntity.prototype, "lane", null);
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.string })
], NodeDefEntity.prototype, "type", null);
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.object })
], NodeDefEntity.prototype, "extensions", null);
__decorate([
    metadata_1.schemaAttribute({ type: 'NodeDef' })
], NodeDefEntity.prototype, "attachedToNode", null);
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.object })
], NodeDefEntity.prototype, "events", null);
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.string })
], NodeDefEntity.prototype, "script", null);
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.string })
], NodeDefEntity.prototype, "eventType", null);
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.boolean })
], NodeDefEntity.prototype, "cancelActivity", null);
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.string })
], NodeDefEntity.prototype, "subProcessKey", null);
__decorate([
    metadata_1.schemaAttribute({ type: 'NodeDef' })
], NodeDefEntity.prototype, "subProcessDef", null);
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.number })
], NodeDefEntity.prototype, "counter", null);
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.number })
], NodeDefEntity.prototype, "timerDefinitionType", null);
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.string })
], NodeDefEntity.prototype, "timerDefinition", null);
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.string })
], NodeDefEntity.prototype, "startContext", null);
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.string })
], NodeDefEntity.prototype, "startContextEntityType", null);
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.string })
], NodeDefEntity.prototype, "signal", null);
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.string })
], NodeDefEntity.prototype, "message", null);
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.string })
], NodeDefEntity.prototype, "condition", null);
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.string })
], NodeDefEntity.prototype, "errorName", null);
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.string })
], NodeDefEntity.prototype, "errorCode", null);
exports.NodeDefEntity = NodeDefEntity;

//# sourceMappingURL=node_def.js.map
