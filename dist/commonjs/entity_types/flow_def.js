"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var data_model_contracts_1 = require("data_model_contracts");
var FlowDefEntity = (function (_super) {
    __extends(FlowDefEntity, _super);
    function FlowDefEntity(propertyBagFactory, invoker, entityType, context, schemas) {
        return _super.call(this, propertyBagFactory, invoker, entityType, context, schemas) || this;
    }
    return FlowDefEntity;
}(data_model_contracts_1.Entity));
FlowDefEntity.attributes = {
    name: { type: 'string' },
    key: { type: 'string' },
    processDef: { type: 'ProcessDef' },
    source: { type: 'NodeDef' },
    target: { type: 'NodeDef' },
    condition: { type: 'string' }
};
exports.FlowDefEntity = FlowDefEntity;

//# sourceMappingURL=flow_def.js.map
