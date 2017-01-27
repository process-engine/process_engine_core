"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var core_contracts_1 = require("@process-engine-js/core_contracts");
var data_model_contracts_1 = require("@process-engine-js/data_model_contracts");
var metadata_1 = require("@process-engine-js/metadata");
var FlowDefEntity = (function (_super) {
    __extends(FlowDefEntity, _super);
    function FlowDefEntity(propertyBagFactory, invoker, entityType, context, schema) {
        return _super.call(this, propertyBagFactory, invoker, entityType, context, schema) || this;
    }
    Object.defineProperty(FlowDefEntity.prototype, "name", {
        get: function () {
            return this.getProperty(this, 'name');
        },
        set: function (value) {
            this.setProperty(this, 'name', value);
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(FlowDefEntity.prototype, "key", {
        get: function () {
            return this.getProperty(this, 'key');
        },
        set: function (value) {
            this.setProperty(this, 'key', value);
        },
        enumerable: true,
        configurable: true
    });
    FlowDefEntity.prototype.getProcessDef = function () {
        return this.getPropertyLazy(this, 'processDef');
    };
    FlowDefEntity.prototype.setProcessDef = function (value) {
        this.setProperty(this, 'processDef', value);
    };
    FlowDefEntity.prototype.getSource = function () {
        return this.getPropertyLazy(this, 'source');
    };
    FlowDefEntity.prototype.setSource = function (value) {
        this.setProperty(this, 'source', value);
    };
    FlowDefEntity.prototype.getTarget = function () {
        return this.getPropertyLazy(this, 'target');
    };
    FlowDefEntity.prototype.setTarget = function (value) {
        this.setProperty(this, 'source', value);
    };
    Object.defineProperty(FlowDefEntity.prototype, "condition", {
        get: function () {
            return this.getProperty(this, 'condition');
        },
        set: function (value) {
            this.setProperty(this, 'condition', value);
        },
        enumerable: true,
        configurable: true
    });
    return FlowDefEntity;
}(data_model_contracts_1.Entity));
FlowDefEntity.attributes = {
    name: { type: 'string' },
    key: { type: 'string' },
    processDef: { type: 'ProcessDef' },
    source: { type: 'NodeDef' },
    target: { type: 'NodeDef' },
    condition: { type: 'string' }
};
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.string })
], FlowDefEntity.prototype, "name", null);
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.string })
], FlowDefEntity.prototype, "key", null);
__decorate([
    metadata_1.schemaAttribute({ type: 'ProcessDef' })
], FlowDefEntity.prototype, "getProcessDef", null);
__decorate([
    metadata_1.schemaAttribute({ type: 'NodeDef' })
], FlowDefEntity.prototype, "getSource", null);
__decorate([
    metadata_1.schemaAttribute({ type: 'NodeDef' })
], FlowDefEntity.prototype, "getTarget", null);
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.string })
], FlowDefEntity.prototype, "condition", null);
exports.FlowDefEntity = FlowDefEntity;

//# sourceMappingURL=flow_def.js.map
