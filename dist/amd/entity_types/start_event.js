define(["require", "exports", "./event"], function (require, exports, event_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class StartEventEntity extends event_1.EventEntity {
        constructor(nodeInstanceEntityDependencyHelper, entityDependencyHelper, context, schema, propertyBag) {
            super(nodeInstanceEntityDependencyHelper, entityDependencyHelper, context, schema, propertyBag);
        }
        async initialize() {
            await super.initialize(this);
        }
    }
    exports.StartEventEntity = StartEventEntity;
});

//# sourceMappingURL=start_event.js.map
