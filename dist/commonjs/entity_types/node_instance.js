"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var data_model_contracts_1 = require("data_model_contracts");
var NodeInstanceEntity = (function (_super) {
    __extends(NodeInstanceEntity, _super);
    function NodeInstanceEntity(propertyBagFactory, invoker, entityType, context, schemas) {
        return _super.call(this, propertyBagFactory, invoker, entityType, context, schemas) || this;
    }
    return NodeInstanceEntity;
}(data_model_contracts_1.Entity));
NodeInstanceEntity.attributes = {
    name: { type: 'string' },
    key: { type: 'string' },
    process: { type: 'Process' },
    nodeDef: { type: 'NodeDef' },
    type: { type: 'string' },
    state: { type: 'string' },
    participant: { type: 'string' },
    processToken: { type: 'ProcessToken' }
};
NodeInstanceEntity.expand = [
    { attribute: 'nodeDef', depth: 2 },
    { attribute: 'processToken', depth: 2 }
];
exports.NodeInstanceEntity = NodeInstanceEntity;

//# sourceMappingURL=node_instance.js.map
