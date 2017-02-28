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
class NodeDefEntity extends data_model_contracts_1.Entity {
    constructor(entityDependencyHelper) {
        super(entityDependencyHelper);
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
    get processDef() {
        return this.getProperty(this, 'processDef');
    }
    set processDef(value) {
        this.setProperty(this, 'processDef', value);
    }
    getProcessDef() {
        return this.getPropertyLazy(this, 'processDef');
    }
    get lane() {
        return this.getProperty(this, 'lane');
    }
    set lane(value) {
        this.setProperty(this, 'lane', value);
    }
    getLane() {
        return this.getPropertyLazy(this, 'lane');
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
    getAttachedToNode() {
        return this.getPropertyLazy(this, 'attachedToNode');
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
    getSubProcessDef() {
        return this.getPropertyLazy(this, 'subProcessDef');
    }
    getLaneRole(context) {
        return __awaiter(this, void 0, void 0, function* () {
            const lane = yield this.getLane();
            const extensions = lane.extensions;
            const properties = (extensions && extensions.properties) ? extensions.properties : null;
            let found = null;
            if (properties) {
                properties.some((property) => {
                    if (property.name === 'role') {
                        found = property.value;
                        return true;
                    }
                });
            }
            return found;
        });
    }
    getBoundaryEvents(context) {
        return __awaiter(this, void 0, void 0, function* () {
            const nodeDefEntityType = yield this.datastoreService.getEntityType('NodeDef');
            const queryObject = [
                { attribute: 'attachedToNode', operator: '=', value: this.id }
            ];
            const boundaryColl = yield nodeDefEntityType.query(context, { query: queryObject });
            return boundaryColl;
        });
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
exports.NodeDefEntity = NodeDefEntity;

//# sourceMappingURL=node_def.js.map
