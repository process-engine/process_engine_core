"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var node_instance_1 = require("./node_instance");
var ServiceTaskEntity = (function (_super) {
    __extends(ServiceTaskEntity, _super);
    function ServiceTaskEntity(propertyBagFactory, invoker, entityType, context, schema) {
        return _super.call(this, propertyBagFactory, invoker, entityType, context, schema) || this;
    }
    return ServiceTaskEntity;
}(node_instance_1.NodeInstanceEntity));
exports.ServiceTaskEntity = ServiceTaskEntity;

//# sourceMappingURL=service_task.js.map
