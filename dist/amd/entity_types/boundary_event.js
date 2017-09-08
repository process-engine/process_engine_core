define(["require", "exports", "./event"], function (require, exports, event_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class BoundaryEventEntity extends event_1.EventEntity {
        constructor(nodeInstanceEntityDependencyHelper, entityDependencyHelper, context, schema, propertyBag, entityType) {
            super(nodeInstanceEntityDependencyHelper, entityDependencyHelper, context, schema, propertyBag, entityType);
            this.attachedToInstance = undefined;
        }
        async initialize() {
            await super.initialize(this);
        }
        async execute(context) {
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
            }
            this.changeState(context, 'wait', this);
        }
        async proceed(context, data, source, applicationId, participant) {
            const parent = this.attachedToInstance;
            await parent.triggerBoundaryEvent(context, this, data);
        }
    }
    exports.BoundaryEventEntity = BoundaryEventEntity;
});

//# sourceMappingURL=boundary_event.js.map
