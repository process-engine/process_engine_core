"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const event_1 = require("./event");
class EndEventEntity extends event_1.EventEntity {
    constructor(nodeInstanceEntityDependencyHelper, entityDependencyHelper, context, schema) {
        super(nodeInstanceEntityDependencyHelper, entityDependencyHelper, context, schema);
    }
    async initialize(derivedClassInstance) {
        const actualInstance = derivedClassInstance || this;
        await super.initialize(actualInstance);
    }
}
exports.EndEventEntity = EndEventEntity;

//# sourceMappingURL=end_event.js.map
