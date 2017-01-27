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
var ProcessTokenEntity = (function (_super) {
    __extends(ProcessTokenEntity, _super);
    function ProcessTokenEntity(propertyBagFactory, invoker, entityType, context, schema) {
        return _super.call(this, propertyBagFactory, invoker, entityType, context, schema) || this;
    }
    ProcessTokenEntity.prototype.initialize = function (derivedClassInstance) {
        var actualInstance = derivedClassInstance || this;
        _super.prototype.initialize.call(this, actualInstance);
    };
    Object.defineProperty(ProcessTokenEntity.prototype, "data", {
        get: function () {
            return this.getProperty(this, 'data');
        },
        set: function (value) {
            this.setProperty(this, 'data', value);
        },
        enumerable: true,
        configurable: true
    });
    ProcessTokenEntity.prototype.getProcess = function () {
        return this.getPropertyLazy(this, 'process');
    };
    ProcessTokenEntity.prototype.setProcess = function (value) {
        this.setProperty(this, 'process', value);
    };
    return ProcessTokenEntity;
}(data_model_contracts_1.Entity));
ProcessTokenEntity.attributes = {
    data: { type: 'object' },
    process: { type: 'Process' }
};
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.object })
], ProcessTokenEntity.prototype, "data", null);
__decorate([
    metadata_1.schemaAttribute({ type: 'Process' })
], ProcessTokenEntity.prototype, "getProcess", null);
exports.ProcessTokenEntity = ProcessTokenEntity;

//# sourceMappingURL=process_token.js.map
