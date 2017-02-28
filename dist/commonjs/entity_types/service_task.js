"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_instance_1 = require("./node_instance");
class ServiceTaskEntity extends node_instance_1.NodeInstanceEntity {
    constructor(container, nodeInstanceEntityDependencyHelper, entityDependencyHelper) {
        super(nodeInstanceEntityDependencyHelper, entityDependencyHelper);
        this._container = undefined;
        this._container = container;
    }
    get container() {
        return this._container;
    }
    initialize(derivedClassInstance) {
        const _super = name => super[name];
        return __awaiter(this, void 0, void 0, function* () {
            const actualInstance = derivedClassInstance || this;
            yield _super("initialize").call(this, actualInstance);
        });
    }
    execute(context) {
        return __awaiter(this, void 0, void 0, function* () {
            const internalContext = yield this.iamService.createInternalContext('processengine_system');
            this.state = 'progress';
            yield this.save(internalContext);
            const processToken = yield this.getProcessToken();
            const tokenData = processToken.data || {};
            let continueEnd = true;
            const nodeDef = yield this.getNodeDef();
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
                    const service = this.container.resolve(serviceModule);
                    let params = [];
                    let result;
                    try {
                        const functionString = 'return ' + paramString;
                        const evaluateFunction = new Function(functionString);
                        params = evaluateFunction.call(tokenData);
                        result = yield service[serviceMethod].apply(this, [context].concat(params));
                    }
                    catch (err) {
                        result = err;
                        continueEnd = false;
                        yield this.error(context, err);
                    }
                    tokenData.current = result;
                    processToken.data = tokenData;
                    yield processToken.save(null, internalContext);
                }
            }
            if (continueEnd) {
                yield this.changeState(context, 'end', this);
            }
        });
    }
}
exports.ServiceTaskEntity = ServiceTaskEntity;

//# sourceMappingURL=service_task.js.map
