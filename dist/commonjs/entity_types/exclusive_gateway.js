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
var node_instance_1 = require("./node_instance");
var core_contracts_1 = require("@process-engine-js/core_contracts");
var metadata_1 = require("@process-engine-js/metadata");
var ExclusiveGatewayEntity = (function (_super) {
    __extends(ExclusiveGatewayEntity, _super);
    function ExclusiveGatewayEntity(propertyBagFactory, invoker, entityType, context, schema) {
        return _super.call(this, propertyBagFactory, invoker, entityType, context, schema) || this;
    }
    ExclusiveGatewayEntity.prototype.initialize = function (derivedClassInstance) {
        var actualInstance = derivedClassInstance || this;
        _super.prototype.initialize.call(this, actualInstance);
    };
    Object.defineProperty(ExclusiveGatewayEntity.prototype, "follow", {
        get: function () {
            return this.getProperty(this, 'follow');
        },
        set: function (value) {
            this.setProperty(this, 'follow', value);
        },
        enumerable: true,
        configurable: true
    });
    return ExclusiveGatewayEntity;
}(node_instance_1.NodeInstanceEntity));
ExclusiveGatewayEntity.attributes = {
    follow: { type: 'object' }
};
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.object })
], ExclusiveGatewayEntity.prototype, "follow", null);
exports.ExclusiveGatewayEntity = ExclusiveGatewayEntity;

//# sourceMappingURL=exclusive_gateway.js.map
