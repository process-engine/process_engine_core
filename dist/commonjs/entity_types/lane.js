"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var data_model_contracts_1 = require("@process-engine-js/data_model_contracts");
var LaneEntity = (function (_super) {
    __extends(LaneEntity, _super);
    function LaneEntity(propertyBagFactory, invoker, entityType, context, schema) {
        return _super.call(this, propertyBagFactory, invoker, entityType, context, schema) || this;
    }
    return LaneEntity;
}(data_model_contracts_1.Entity));
LaneEntity.attributes = {
    name: { type: 'string' },
    key: { type: 'string' },
    extensions: { type: 'object' },
    processDef: { type: 'ProcessDef' }
};
LaneEntity.datasources = [
    'processengine'
];
exports.LaneEntity = LaneEntity;

//# sourceMappingURL=lane.js.map
