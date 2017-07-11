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
        this.state = 'progress';
        const processToken = this.processToken;
        const tokenData = processToken.data || {};
        let continueEnd = true;
        // call service
        const nodeDef = this.nodeDef;
        const extensions = nodeDef.extensions || null;
        const props = (extensions && extensions.properties) ? extensions.properties : null;
        if (props) {
            let serviceModule;
            let serviceMethod;
            let namespace;
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
                if (prop.name === 'namespace') {
                    namespace = prop.value;
                }
            });
            if (serviceModule && serviceMethod) {
                const serviceInstance = this.container.resolve(serviceModule);
                let result;
                try {
                    const self = this;
                    const cb = function (data) {
                        const eventData = {
                            action: 'event',
                            event: 'condition',
                            data: data
                        };
                        const event = self.eventAggregator.createEntityEvent(eventData, self, context, (('participant' in self) ? { participantId: self.participant } : null));
                        self.eventAggregator.publish('/processengine/node/' + self.id, event);
                    };
                    const argumentsToPassThrough = (new Function('context', 'token', 'callback', 'return ' + paramString)).call(tokenData, context, tokenData, cb) || [];
                    result = await this.invoker.invoke(serviceInstance, serviceMethod, namespace, context, ...argumentsToPassThrough);
                }
                catch (err) {
                    result = err;
                    continueEnd = false;
                    await this.error(context, err);
                }
                let finalResult = result;
                const toPojoOptions = { skipCalculation: true };
                if (result && typeof result.toPojos === 'function') {
                    finalResult = await result.toPojos(context, toPojoOptions);
                }
                else if (result && typeof result.toPojo === 'function') {
                    finalResult = await result.toPojo(context, toPojoOptions);
                }
                tokenData.current = finalResult;
                processToken.data = tokenData;
            }
        }
        if (continueEnd) {
            this.changeState(context, 'end', this);
        }
    }
}
exports.ServiceTaskEntity = ServiceTaskEntity;

//# sourceMappingURL=service_task.js.map
