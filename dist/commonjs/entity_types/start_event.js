"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const event_1 = require("./event");
class StartEventEntity extends event_1.EventEntity {
    constructor(nodeInstanceEntityDependencyHelper, entityDependencyHelper, context, schema) {
        super(nodeInstanceEntityDependencyHelper, entityDependencyHelper, context, schema);
    }
    async initialize(derivedClassInstance) {
        const actualInstance = derivedClassInstance || this;
        await super.initialize(actualInstance);
    }
}
exports.StartEventEntity = StartEventEntity;

//# sourceMappingURL=start_event.js.map
