"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var node_instance_1 = require("./node_instance");
var ScriptTaskEntity = (function (_super) {
    __extends(ScriptTaskEntity, _super);
    function ScriptTaskEntity(propertyBagFactory, invoker, entityType, context, schema) {
        return _super.call(this, propertyBagFactory, invoker, entityType, context, schema) || this;
    }
    return ScriptTaskEntity;
}(node_instance_1.NodeInstanceEntity));
ScriptTaskEntity.attributes = {
    script: { type: 'string' }
};
exports.ScriptTaskEntity = ScriptTaskEntity;

//# sourceMappingURL=script_task.js.map
