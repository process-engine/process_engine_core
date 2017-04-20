"use strict";
const event_1 = require("./event");
class ThrowEventEntity extends event_1.EventEntity {
    constructor(nodeInstanceEntityDependencyHelper, entityDependencyHelper, context, schema) {
        super(nodeInstanceEntityDependencyHelper, entityDependencyHelper, context, schema);
    }
    async initialize(derivedClassInstance) {
        const actualInstance = derivedClassInstance || this;
        await super.initialize(actualInstance);
    }
    async execute(context) {
        const nodeDef = this.nodeDef;
        let data;
        let msg;
        switch (nodeDef.eventType) {
            case 'bpmn:SignalEventDefinition':
                const signal = this.nodeDef.signal;
                data = {};
                msg = this.messageBusService.createEntityMessage(data, this, context);
                await this.messageBusService.publish('/processengine/signal/' + signal, msg);
                break;
            case 'bpmn:MessageEventDefinition':
                const message = this.nodeDef.message;
                data = {};
                msg = this.messageBusService.createEntityMessage(data, this, context);
                await this.messageBusService.publish('/processengine/message/' + message, msg);
                break;
            default:
        }
        this.changeState(context, 'end', this);
    }
}
exports.ThrowEventEntity = ThrowEventEntity;

//# sourceMappingURL=throw_event.js.map
