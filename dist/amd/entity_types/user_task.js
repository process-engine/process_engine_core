var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
define(["require", "exports", "@process-engine-js/metadata", "./node_instance"], function (require, exports, metadata_1, node_instance_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    let UserTaskEntity = class UserTaskEntity extends node_instance_1.NodeInstanceEntity {
        constructor(nodeInstanceEntityDependencyHelper, entityDependencyHelper, context, schema, propertyBag) {
            super(nodeInstanceEntityDependencyHelper, entityDependencyHelper, context, schema, propertyBag);
        }
        async initialize() {
            await super.initialize(this);
        }
        async execute(context) {
            const internalContext = await this.iamService.createInternalContext('processengine_system');
            const laneRole = await this.getLaneRole(internalContext);
            if (!context.hasRole(laneRole)) {
                this.participant = null;
            }
            this.changeState(context, 'wait', this);
            const pojo = await this.toPojo(internalContext, { maxDepth: 1 });
            let uiName;
            let uiConfig;
            const processToken = pojo.processToken;
            const token = processToken.data || {};
            let uiData = token;
            const nodeDef = this.nodeDef;
            const extensions = nodeDef.extensions || null;
            const props = (extensions && extensions.properties) ? extensions.properties : null;
            if (props) {
                props.forEach((prop) => {
                    if (prop.name === 'uiName') {
                        uiName = this.parseExtensionProperty(prop.value, token, context);
                    }
                    if (prop.name === 'uiConfig') {
                        uiConfig = this.parseExtensionProperty(prop.value, token, context);
                    }
                    if (prop.name === 'uiData') {
                        uiData = this.parseExtensionProperty(prop.value, token, context);
                    }
                });
            }
            const userTaskMessageData = {
                userTaskEntity: pojo,
                uiName: uiName,
                uiData: uiData,
                uiConfig: uiConfig
            };
            const data = {
                action: 'userTask',
                data: userTaskMessageData
            };
            const msg = this.messageBusService.createEntityMessage(data, this, context);
            if (this.participant) {
                await this.messageBusService.publish('/participant/' + this.participant, msg);
            }
            else {
                const role = await this.nodeDef.lane.role;
                await this.messageBusService.publish('/role/' + role, msg);
            }
        }
        async proceed(context, newData, source, applicationId, participant) {
            if (this.participant !== participant) {
                this.participant = participant;
            }
            const processToken = this.processToken;
            const tokenData = processToken.data || {};
            tokenData.current = newData;
            processToken.data = tokenData;
            this.changeState(context, 'end', this);
        }
    };
    UserTaskEntity = __decorate([
        metadata_1.schemaClass({
            expandEntity: [
                { attribute: 'nodeDef' },
                { attribute: 'processToken' }
            ]
        })
    ], UserTaskEntity);
    exports.UserTaskEntity = UserTaskEntity;
});

//# sourceMappingURL=user_task.js.map
