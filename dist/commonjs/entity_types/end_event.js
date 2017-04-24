"use strict";
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
        const internalContext = await this.iamService.createInternalContext('processengine_system');
        this.state = 'progress';
        await this.save(internalContext);
        const processToken = await this.getProcessToken(internalContext);
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
            const role = await this.getLaneRole(internalContext);
            await this.messageBusService.publish('/role/' + role, msg);
        }
        this.changeState(context, 'end', this);
    }
}
exports.EndEventEntity = EndEventEntity;

//# sourceMappingURL=end_event.js.map
