"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var event_1 = require("./event");
var EndEventEntity = (function (_super) {
    __extends(EndEventEntity, _super);
    function EndEventEntity(propertyBagFactory, invoker, entityType, context, schemas) {
        return _super.call(this, propertyBagFactory, invoker, entityType, context, schemas) || this;
    }
    return EndEventEntity;
}(event_1.EventEntity));
exports.EndEventEntity = EndEventEntity;

//# sourceMappingURL=end_event.js.map
