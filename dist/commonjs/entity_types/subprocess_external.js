"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_instance_1 = require("./node_instance");
class SubprocessExternalEntity extends node_instance_1.NodeInstanceEntity {
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
        const processToken = await this.getProcessToken(internalContext);
        const tokenData = processToken.data || {};
        const nodeDef = await this.getNodeDef(internalContext);
        const subProcessKey = nodeDef.subProcessKey || null;
        if (subProcessKey) {
            const source = this.getEntityReference();
            const data = {
                action: 'start',
                data: {
                    key: subProcessKey,
                    token: tokenData,
                    source: source,
                    isSubProcess: true
                }
            };
            const msg = this.messageBusService.createEntityMessage(data, this, context);
            await this.messageBusService.publish('/processengine', msg);
        }
    }
    async proceed(context, newData, source, applicationId) {
        const internalContext = await this.iamService.createInternalContext('processengine_system');
        const processToken = await this.getProcessToken(internalContext);
        const tokenData = processToken.data || {};
        tokenData.current = newData;
        processToken.data = tokenData;
        await processToken.save(internalContext);
        this.changeState(context, 'end', this);
    }
}
exports.SubprocessExternalEntity = SubprocessExternalEntity;

//# sourceMappingURL=subprocess_external.js.map
