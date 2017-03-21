"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_instance_1 = require("./node_instance");
class ServiceTaskEntity extends node_instance_1.NodeInstanceEntity {
    constructor(container, nodeInstanceEntityDependencyHelper, entityDependencyHelper, context, schema) {
        super(nodeInstanceEntityDependencyHelper, entityDependencyHelper, context, schema);
        this._container = undefined;
        this._container = container;
    }
    get container() {
        return this._container;
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
        const tokenData = processToken.data || {};
        let continueEnd = true;
        const nodeDef = await this.getNodeDef(internalContext);
        const extensions = nodeDef.extensions || null;
        const props = (extensions && extensions.properties) ? extensions.properties : null;
        if (props) {
            let serviceModule;
            let serviceMethod;
            let paramString;
            props.forEach((prop) => {
                if (prop.name === 'module') {
                    serviceModule = prop.value;
                }
                if (prop.name === 'method') {
                    serviceMethod = prop.value;
                }
                if (prop.name === 'params') {
                    paramString = prop.value;
                }
            });
            if (serviceModule && serviceMethod) {
                const serviceInstance = this.container.resolve(serviceModule);
                let result;
                try {
                    const argumentsToPassThrough = (new Function('context', 'tokenData', 'return ' + paramString)).call(tokenData, context, tokenData) || [];
                    result = await this.invoker.invoke(serviceInstance, serviceMethod, context, ...argumentsToPassThrough);
                }
                catch (err) {
                    result = err;
                    continueEnd = false;
                    await this.error(context, err);
                }
                tokenData.current = result;
                processToken.data = tokenData;
                await processToken.save(internalContext);
            }
        }
        if (continueEnd) {
            await this.changeState(context, 'end', this);
        }
    }
}
exports.ServiceTaskEntity = ServiceTaskEntity;

//# sourceMappingURL=service_task.js.map
