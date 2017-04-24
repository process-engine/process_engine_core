"use strict";
const event_1 = require("./event");
const process_engine_contracts_1 = require("@process-engine-js/process_engine_contracts");
class BoundaryEventEntity extends event_1.EventEntity {
    constructor(nodeInstanceEntityDependencyHelper, entityDependencyHelper, context, schema) {
        super(nodeInstanceEntityDependencyHelper, entityDependencyHelper, context, schema);
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
    async proceed(context, data, source, applicationId) {
        await this.nodeDef.getAttachedToNode(context);
        const targetId = this.nodeDef.attachedToNode.id;
        let event;
        if (this.nodeDef.timerDefinitionType !== process_engine_contracts_1.TimerDefinitionType.cycle || this.nodeDef.cancelActivity) {
            event = {
                action: 'changeState',
                data: 'end'
            };
        }
        else {
            event = {
                action: 'event',
                data: {
                    event: 'timer',
                    data: {}
                }
            };
        }
        this.eventAggregator.publish('/processengine/node/' + targetId, event);
    }
}
exports.BoundaryEventEntity = BoundaryEventEntity;

//# sourceMappingURL=boundary_event.js.map
