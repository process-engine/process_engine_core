"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const event_1 = require("./event");
class BoundaryEventEntity extends event_1.EventEntity {
    constructor(nodeInstanceEntityDependencyHelper, entityDependencyHelper, context, schema) {
        super(nodeInstanceEntityDependencyHelper, entityDependencyHelper, context, schema);
        this.attachedToInstance = undefined;
    }
    async initialize(derivedClassInstance) {
        const actualInstance = derivedClassInstance || this;
        await super.initialize(actualInstance);
    }
    async execute(context) {
        const nodeDef = this.nodeDef;
        switch (nodeDef.eventType) {
            case 'bpmn:SignalEventDefinition':
                this.changeState(context, 'wait', this);
                await this.initializeSignal();
                break;
            case 'bpmn:MessageEventDefinition':
                this.changeState(context, 'wait', this);
                await this.initializeMessage();
                break;
            case 'bpmn:TimerEventDefinition':
                this.changeState(context, 'wait', this);
                await this.initializeTimer();
                break;
            default:
                this.changeState(context, 'end', this);
        }
    }
    async proceed(context, data, source, applicationId, participant) {
        const target = this.attachedToInstance;
        const payload = {
            action: 'event',
            event: 'timer',
            data: {}
        };
        const event = this.eventAggregator.createEntityEvent(payload, source, context, (source && ('participant' in source) ? { participantId: source.participant } : null));
        this.eventAggregator.publish('/processengine/node/' + target.id, event);
    }
}
exports.BoundaryEventEntity = BoundaryEventEntity;

//# sourceMappingURL=boundary_event.js.map
