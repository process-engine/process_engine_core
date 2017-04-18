"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const event_1 = require("./event");
class CatchEventEntity extends event_1.EventEntity {
    constructor(nodeInstanceEntityDependencyHelper, entityDependencyHelper, context, schema) {
        super(nodeInstanceEntityDependencyHelper, entityDependencyHelper, context, schema);
    }
    async initialize(derivedClassInstance) {
        const actualInstance = derivedClassInstance || this;
        await super.initialize(actualInstance);
    }
}
exports.CatchEventEntity = CatchEventEntity;

//# sourceMappingURL=catch_event.js.map
