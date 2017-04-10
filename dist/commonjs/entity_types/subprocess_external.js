"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_instance_1 = require("./node_instance");
const debug = require("debug");
const debugInfo = debug('processengine:info');
const debugErr = debug('processengine:error');
class SubprocessExternalEntity extends node_instance_1.NodeInstanceEntity {
    constructor(nodeInstanceEntityDependencyHelper, processDefEntityTypeService, entityDependencyHelper, context, schema) {
        super(nodeInstanceEntityDependencyHelper, entityDependencyHelper, context, schema);
        this._processDefEntityTypeService = undefined;
        this._processDefEntityTypeService = processDefEntityTypeService;
    }
    get processDefEntityTypeService() {
        return this._processDefEntityTypeService;
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
            const params = {
                key: subProcessKey,
                source: this,
                isSubProcess: true,
                initialToken: tokenData
            };
            await this.processDefEntityTypeService.start(internalContext, params);
        }
        else {
            debugInfo(`No key is provided for call activity key '${this.key}'`);
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
