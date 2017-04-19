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
        const internalContext = await this.iamService.createInternalContext('processengine_system');
        this.state = 'wait';
        await this.save(internalContext);
        const nodeDef = this.nodeDef;
        switch (nodeDef.eventType) {
            case 'bpmn:SignalEventDefinition':
                const signal = nodeDef.signal;
                await this._signalSubscribe(signal);
                break;
            default:
        }
    }
    async proceed(context, newData) {
        this.changeState(context, 'end', this);
    }
}
exports.CatchEventEntity = CatchEventEntity;

//# sourceMappingURL=catch_event.js.map
