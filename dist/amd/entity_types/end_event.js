define(["require", "exports", "./event"], function (require, exports, event_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class EndEventEntity extends event_1.EventEntity {
        constructor(nodeInstanceEntityDependencyHelper, entityDependencyHelper, context, schema, propertyBag, entityType) {
            super(nodeInstanceEntityDependencyHelper, entityDependencyHelper, context, schema, propertyBag, entityType);
        }
        async initialize() {
            await super.initialize(this);
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
});

//# sourceMappingURL=end_event.js.map
