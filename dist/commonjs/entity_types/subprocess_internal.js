"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_instance_1 = require("./node_instance");
class SubprocessInternalEntity extends node_instance_1.NodeInstanceEntity {
    constructor(nodeInstanceEntityDependencyHelper, entityDependencyHelper, context, schema, propertyBag, entityType) {
        super(nodeInstanceEntityDependencyHelper, entityDependencyHelper, context, schema, propertyBag, entityType);
    }
    async initialize() {
        await super.initialize(this);
    }
}
exports.SubprocessInternalEntity = SubprocessInternalEntity;

//# sourceMappingURL=subprocess_internal.js.map
