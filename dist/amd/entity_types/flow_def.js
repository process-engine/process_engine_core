var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
define(["require", "exports", "@process-engine-js/core_contracts", "@process-engine-js/data_model_contracts", "@process-engine-js/metadata"], function (require, exports, core_contracts_1, data_model_contracts_1, metadata_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class FlowDefEntity extends data_model_contracts_1.Entity {
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
        get source() {
            return this.getProperty(this, 'source');
        }
        set source(value) {
            this.setProperty(this, 'source', value);
        }
        getSource(context) {
            return this.getPropertyLazy(this, 'source', context);
        }
        get target() {
            return this.getProperty(this, 'target');
        }
        set target(value) {
            this.setProperty(this, 'target', value);
        }
        getTarget(context) {
            return this.getPropertyLazy(this, 'target', context);
        }
        get condition() {
            return this.getProperty(this, 'condition');
        }
        set condition(value) {
            this.setProperty(this, 'condition', value);
        }
        get extensions() {
            return this.getProperty(this, 'extensions');
        }
        set extensions(value) {
            this.setProperty(this, 'extensions', value);
        }
        get counter() {
            return this.getProperty(this, 'counter');
        }
        set counter(value) {
            this.setProperty(this, 'counter', value);
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
    }
    __decorate([
        metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.string })
    ], FlowDefEntity.prototype, "name", null);
    __decorate([
        metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.string })
    ], FlowDefEntity.prototype, "key", null);
    __decorate([
        metadata_1.schemaAttribute({ type: 'ProcessDef' })
    ], FlowDefEntity.prototype, "processDef", null);
    __decorate([
        metadata_1.schemaAttribute({ type: 'NodeDef' })
    ], FlowDefEntity.prototype, "source", null);
    __decorate([
        metadata_1.schemaAttribute({ type: 'NodeDef' })
    ], FlowDefEntity.prototype, "target", null);
    __decorate([
        metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.string })
    ], FlowDefEntity.prototype, "condition", null);
    __decorate([
        metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.object })
    ], FlowDefEntity.prototype, "extensions", null);
    __decorate([
        metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.number })
    ], FlowDefEntity.prototype, "counter", null);
    exports.FlowDefEntity = FlowDefEntity;
});

//# sourceMappingURL=flow_def.js.map
