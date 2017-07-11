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
    async execute(context) {
        this.changeState(context, 'wait', this);
        const nodeDef = this.nodeDef;
        switch (nodeDef.eventType) {
            case 'bpmn:SignalEventDefinition':
                await this.initializeSignal();
                break;
            case 'bpmn:MessageEventDefinition':
                await this.initializeMessage();
                break;
            case 'bpmn:TimerEventDefinition':
                await this.initializeTimer();
                break;
            default:
                // no support of other event definition, simply end task
                this.changeState(context, 'end', this);
        }
    }
    async proceed(context, newData, source, applicationId, participant) {
        this.changeState(context, 'end', this);
    }
}
exports.CatchEventEntity = CatchEventEntity;

//# sourceMappingURL=catch_event.js.map
