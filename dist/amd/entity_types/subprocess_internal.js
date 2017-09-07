define(["require", "exports", "./node_instance"], function (require, exports, node_instance_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class SubprocessInternalEntity extends node_instance_1.NodeInstanceEntity {
        constructor(nodeInstanceEntityDependencyHelper, entityDependencyHelper, context, schema, propertyBag, entityType) {
            super(nodeInstanceEntityDependencyHelper, entityDependencyHelper, context, schema, propertyBag, entityType);
        }
        async initialize() {
            await super.initialize(this);
        }
    }
    exports.SubprocessInternalEntity = SubprocessInternalEntity;
});

//# sourceMappingURL=subprocess_internal.js.map
