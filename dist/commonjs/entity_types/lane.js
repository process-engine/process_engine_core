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
class LaneEntity extends data_model_contracts_1.Entity {
    constructor(entityDependencyHelper, context, schema) {
        super(entityDependencyHelper, context, schema);
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
    get extensions() {
        return this.getProperty(this, 'extensions');
    }
    set extensions(value) {
        this.setProperty(this, 'extensions', value);
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
    get counter() {
        return this.getProperty(this, 'counter');
    }
    set counter(value) {
        this.setProperty(this, 'counter', value);
    }
    get features() {
        return this._extractFeatures();
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
        return features;
    }
}
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.string })
], LaneEntity.prototype, "name", null);
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.string })
], LaneEntity.prototype, "key", null);
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.object })
], LaneEntity.prototype, "extensions", null);
__decorate([
    metadata_1.schemaAttribute({ type: 'ProcessDef' })
], LaneEntity.prototype, "processDef", null);
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.number })
], LaneEntity.prototype, "counter", null);
exports.LaneEntity = LaneEntity;

//# sourceMappingURL=lane.js.map
