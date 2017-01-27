"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var node_instance_1 = require("./node_instance");
var UserTaskEntity = (function (_super) {
    __extends(UserTaskEntity, _super);
    function UserTaskEntity(propertyBagFactory, invoker, entityType, context, schema) {
        return _super.call(this, propertyBagFactory, invoker, entityType, context, schema) || this;
    }
    UserTaskEntity.prototype.initialize = function (derivedClassInstance) {
        var actualInstance = derivedClassInstance || this;
        _super.prototype.initialize.call(this, actualInstance);
    };
    return UserTaskEntity;
}(node_instance_1.NodeInstanceEntity));
exports.UserTaskEntity = UserTaskEntity;

//# sourceMappingURL=user_task.js.map
