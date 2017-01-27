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
var NodeInstanceEntity = (function (_super) {
    __extends(NodeInstanceEntity, _super);
    function NodeInstanceEntity(propertyBagFactory, invoker, entityType, context, schema) {
        return _super.call(this, propertyBagFactory, invoker, entityType, context, schema) || this;
    }
    NodeInstanceEntity.prototype.initialize = function (derivedClassInstance) {
        var actualInstance = derivedClassInstance || this;
        _super.prototype.initialize.call(this, actualInstance);
    };
    Object.defineProperty(NodeInstanceEntity.prototype, "name", {
        get: function () {
            return this.getProperty(this, 'name');
        },
        set: function (value) {
            this.setProperty(this, 'name', value);
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(NodeInstanceEntity.prototype, "key", {
        get: function () {
            return this.getProperty(this, 'key');
        },
        set: function (value) {
            this.setProperty(this, 'key', value);
        },
        enumerable: true,
        configurable: true
    });
    NodeInstanceEntity.prototype.getProcess = function () {
        return this.getPropertyLazy(this, 'process');
    };
    NodeInstanceEntity.prototype.setProcess = function (value) {
        this.setProperty(this, 'process', value);
    };
    NodeInstanceEntity.prototype.getNodeDef = function () {
        return this.getPropertyLazy(this, 'nodeDef');
    };
    NodeInstanceEntity.prototype.setNodeDef = function (value) {
        this.setProperty(this, 'nodeDef', value);
    };
    Object.defineProperty(NodeInstanceEntity.prototype, "type", {
        get: function () {
            return this.getProperty(this, 'type');
        },
        set: function (value) {
            this.setProperty(this, 'type', value);
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(NodeInstanceEntity.prototype, "state", {
        get: function () {
            return this.getProperty(this, 'state');
        },
        set: function (value) {
            this.setProperty(this, 'state', value);
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(NodeInstanceEntity.prototype, "participant", {
        get: function () {
            return this.getProperty(this, 'participant');
        },
        set: function (value) {
            this.setProperty(this, 'participant', value);
        },
        enumerable: true,
        configurable: true
    });
    NodeInstanceEntity.prototype.getProcessToken = function () {
        return this.getPropertyLazy(this, 'processToken');
    };
    NodeInstanceEntity.prototype.setProcessToken = function (value) {
        this.setProperty(this, 'processToken', value);
    };
    return NodeInstanceEntity;
}(data_model_contracts_1.Entity));
NodeInstanceEntity.attributes = {
    name: { type: 'string' },
    key: { type: 'string' },
    process: { type: 'Process' },
    nodeDef: { type: 'NodeDef' },
    type: { type: 'string' },
    state: { type: 'string' },
    participant: { type: 'string' },
    processToken: { type: 'ProcessToken' }
};
NodeInstanceEntity.expand = [
    { attribute: 'nodeDef', depth: 2 },
    { attribute: 'processToken', depth: 2 }
];
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.string })
], NodeInstanceEntity.prototype, "name", null);
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.string })
], NodeInstanceEntity.prototype, "key", null);
__decorate([
    metadata_1.schemaAttribute({ type: 'Process' })
], NodeInstanceEntity.prototype, "getProcess", null);
__decorate([
    metadata_1.schemaAttribute({ type: 'NodeDef' })
], NodeInstanceEntity.prototype, "getNodeDef", null);
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
], NodeInstanceEntity.prototype, "getProcessToken", null);
exports.NodeInstanceEntity = NodeInstanceEntity;

//# sourceMappingURL=node_instance.js.map
