"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var event_1 = require("./event");
var StartEventEntity = (function (_super) {
    __extends(StartEventEntity, _super);
    function StartEventEntity(propertyBagFactory, invoker, entityType, context, schema) {
        return _super.call(this, propertyBagFactory, invoker, entityType, context, schema) || this;
    }
    StartEventEntity.prototype.initialize = function (derivedClassInstance) {
        var actualInstance = derivedClassInstance || this;
        _super.prototype.initialize.call(this, actualInstance);
    };
    return StartEventEntity;
}(event_1.EventEntity));
exports.StartEventEntity = StartEventEntity;

//# sourceMappingURL=start_event.js.map
