"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
        const internalContext = await this.iamService.createInternalContext('processengine_system');
        const nodeInstanceEntityType = await this.datastoreService.getEntityType('NodeInstance');
        const attachedToNode = await this.nodeDef.getAttachedToNode(context);
        const targetKey = attachedToNode.key;
        const process = this.process;
        const queryObj = {
            operator: 'and',
            queries: [
                { attribute: 'key', operator: '=', value: targetKey },
                { attribute: 'process', operator: '=', value: process.id }
            ]
        };
        const target = await nodeInstanceEntityType.findOne(internalContext, { query: queryObj });
        let payload;
        if (this.nodeDef.timerDefinitionType !== process_engine_contracts_1.TimerDefinitionType.cycle || this.nodeDef.cancelActivity) {
            payload = {
                action: 'changeState',
                data: 'end'
            };
        }
        else {
            payload = {
                action: 'event',
                data: {
                    event: 'timer',
                    data: {}
                }
            };
        }
        const event = this.eventAggregator.createEntityEvent(payload, source, context);
        this.eventAggregator.publish('/processengine/node/' + target.id, event);
    }
}
exports.BoundaryEventEntity = BoundaryEventEntity;

//# sourceMappingURL=boundary_event.js.map
