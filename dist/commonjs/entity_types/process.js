"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var data_model_contracts_1 = require("data_model_contracts");
var ProcessEntity = (function (_super) {
    __extends(ProcessEntity, _super);
    function ProcessEntity(propertyBagFactory, invoker, entityType, context, schemas) {
        return _super.call(this, propertyBagFactory, invoker, entityType, context, schemas) || this;
    }
    return ProcessEntity;
}(data_model_contracts_1.Entity));
ProcessEntity.attributes = {
    name: { type: 'string' },
    key: { type: 'string' },
    processDef: { type: 'ProcessDef' }
};
exports.ProcessEntity = ProcessEntity;

//# sourceMappingURL=process.js.map
