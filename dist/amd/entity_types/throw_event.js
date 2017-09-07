define(["require", "exports", "./event"], function (require, exports, event_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class ThrowEventEntity extends event_1.EventEntity {
        constructor(nodeInstanceEntityDependencyHelper, entityDependencyHelper, context, schema, propertyBag) {
            super(nodeInstanceEntityDependencyHelper, entityDependencyHelper, context, schema, propertyBag);
        }
        async initialize() {
            await super.initialize(this);
        }
        async execute(context) {
            const nodeDef = this.nodeDef;
            let data;
            let msg;
            switch (nodeDef.eventType) {
                case 'bpmn:SignalEventDefinition':
                    const signal = this.nodeDef.signal;
                    data = {
                        process: this.process.getEntityReference().toPojo(),
                        token: this.processToken.data.current
                    };
                    msg = this.messageBusService.createEntityMessage(data, this, context);
                    await this.messageBusService.publish('/processengine/signal/' + signal, msg);
                    break;
                case 'bpmn:MessageEventDefinition':
                    const message = this.nodeDef.message;
                    data = {
                        process: this.process.getEntityReference().toPojo(),
                        token: this.processToken.data.current
                    };
                    msg = this.messageBusService.createEntityMessage(data, this, context);
                    await this.messageBusService.publish('/processengine/message/' + message, msg);
                    break;
                default:
            }
            this.changeState(context, 'end', this);
        }
    }
    exports.ThrowEventEntity = ThrowEventEntity;
});

//# sourceMappingURL=throw_event.js.map
