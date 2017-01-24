"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var node_instance_1 = require("./node_instance");
var EventEntity = (function (_super) {
    __extends(EventEntity, _super);
    function EventEntity(propertyBagFactory, invoker, entityType, context, schemas) {
        return _super.call(this, propertyBagFactory, invoker, entityType, context, schemas) || this;
    }
    return EventEntity;
}(node_instance_1.NodeInstanceEntity));
exports.EventEntity = EventEntity;

//# sourceMappingURL=event.js.map
