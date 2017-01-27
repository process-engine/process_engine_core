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
var LaneEntity = (function (_super) {
    __extends(LaneEntity, _super);
    function LaneEntity(propertyBagFactory, invoker, entityType, context, schema) {
        return _super.call(this, propertyBagFactory, invoker, entityType, context, schema) || this;
    }
    Object.defineProperty(LaneEntity.prototype, "name", {
        get: function () {
            return this.getProperty(this, 'name');
        },
        set: function (value) {
            this.setProperty(this, 'name', value);
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(LaneEntity.prototype, "key", {
        get: function () {
            return this.getProperty(this, 'key');
        },
        set: function (value) {
            this.setProperty(this, 'key', value);
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(LaneEntity.prototype, "extensions", {
        get: function () {
            return this.getProperty(this, 'extensions');
        },
        set: function (value) {
            this.setProperty(this, 'extensions', value);
        },
        enumerable: true,
        configurable: true
    });
    LaneEntity.prototype.getProcessDef = function () {
        return this.getPropertyLazy(this, 'processDef');
    };
    LaneEntity.prototype.setProcessDef = function (value) {
        this.setProperty(this, 'processDef', value);
    };
    return LaneEntity;
}(data_model_contracts_1.Entity));
LaneEntity.attributes = {
    name: { type: 'string' },
    key: { type: 'string' },
    extensions: { type: 'object' },
    processDef: { type: 'ProcessDef' }
};
LaneEntity.datasources = [
    'processengine'
];
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
], LaneEntity.prototype, "getProcessDef", null);
exports.LaneEntity = LaneEntity;

//# sourceMappingURL=lane.js.map
