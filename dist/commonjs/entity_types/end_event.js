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
    async execute(context) {
        this.state = 'progress';
        const processToken = this.processToken;
        const currentToken = processToken.data.current;
        const data = {
            action: 'endEvent',
            data: currentToken
        };
        const msg = this.messageBusService.createEntityMessage(data, this, context);
        if (this.participant) {
            await this.messageBusService.publish('/participant/' + this.participant, msg);
        }
        else {
            const role = this.nodeDef.lane.role;
            await this.messageBusService.publish('/role/' + role, msg);
        }
        this.changeState(context, 'end', this);
    }
}
exports.EndEventEntity = EndEventEntity;

//# sourceMappingURL=end_event.js.map
