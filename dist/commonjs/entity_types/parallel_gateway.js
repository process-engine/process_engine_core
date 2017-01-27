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
var node_instance_1 = require("./node_instance");
var metadata_1 = require("@process-engine-js/metadata");
var ParallelGatewayEntity = (function (_super) {
    __extends(ParallelGatewayEntity, _super);
    function ParallelGatewayEntity(propertyBagFactory, invoker, entityType, context, schema) {
        return _super.call(this, propertyBagFactory, invoker, entityType, context, schema) || this;
    }
    Object.defineProperty(ParallelGatewayEntity.prototype, "parallelType", {
        get: function () {
            return this.getProperty(this, 'parallelType');
        },
        set: function (value) {
            this.setProperty(this, 'parallelType', value);
        },
        enumerable: true,
        configurable: true
    });
    return ParallelGatewayEntity;
}(node_instance_1.NodeInstanceEntity));
ParallelGatewayEntity.attributes = {
    parallelType: { type: 'string' }
};
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.string })
], ParallelGatewayEntity.prototype, "parallelType", null);
exports.ParallelGatewayEntity = ParallelGatewayEntity;

//# sourceMappingURL=parallel_gateway.js.map
