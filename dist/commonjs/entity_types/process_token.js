"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var data_model_contracts_1 = require("data_model_contracts");
var ProcessTokenEntity = (function (_super) {
    __extends(ProcessTokenEntity, _super);
    function ProcessTokenEntity(propertyBagFactory, invoker, entityType, context, schemas) {
        return _super.call(this, propertyBagFactory, invoker, entityType, context, schemas) || this;
    }
    return ProcessTokenEntity;
}(data_model_contracts_1.Entity));
ProcessTokenEntity.attributes = {
    data: { type: 'object' },
    process: { type: 'Process' }
};
exports.ProcessTokenEntity = ProcessTokenEntity;

//# sourceMappingURL=process_token.js.map
