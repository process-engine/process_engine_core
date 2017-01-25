"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var node_instance_1 = require("./node_instance");
var ExclusiveGatewayEntity = (function (_super) {
    __extends(ExclusiveGatewayEntity, _super);
    function ExclusiveGatewayEntity(propertyBagFactory, invoker, entityType, context, schema) {
        return _super.call(this, propertyBagFactory, invoker, entityType, context, schema) || this;
    }
    return ExclusiveGatewayEntity;
}(node_instance_1.NodeInstanceEntity));
ExclusiveGatewayEntity.attributes = {
    follow: { type: 'object' }
};
exports.ExclusiveGatewayEntity = ExclusiveGatewayEntity;

//# sourceMappingURL=exclusive_gateway.js.map
