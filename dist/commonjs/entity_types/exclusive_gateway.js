"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
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
const core_contracts_1 = require("@process-engine-js/core_contracts");
const metadata_1 = require("@process-engine-js/metadata");
class ExclusiveGatewayEntity extends node_instance_1.NodeInstanceEntity {
    constructor(nodeInstanceEntityDependencyHelper, entityDependencyHelper, context, schema) {
        super(nodeInstanceEntityDependencyHelper, entityDependencyHelper, context, schema);
    }
    initialize(derivedClassInstance) {
        const _super = name => super[name];
        return __awaiter(this, void 0, void 0, function* () {
            const actualInstance = derivedClassInstance || this;
            yield _super("initialize").call(this, actualInstance);
        });
    }
    get follow() {
        return this.getProperty(this, 'follow');
    }
    set follow(value) {
        this.setProperty(this, 'follow', value);
    }
    execute(context) {
        return __awaiter(this, void 0, void 0, function* () {
            const flowDefEntityType = yield this.datastoreService.getEntityType('FlowDef');
            const nodeDef = yield this.getNodeDef();
            const processDef = yield nodeDef.getProcessDef();
            const internalContext = yield this.iamService.createInternalContext('processengine_system');
            const flowsOut = yield flowDefEntityType.query(internalContext, {
                query: [
                    { attribute: 'source', operator: '=', value: nodeDef.id },
                    { attribute: 'processDef', operator: '=', value: processDef.id }
                ]
            });
            const flowsIn = yield flowDefEntityType.query(internalContext, {
                query: [
                    { attribute: 'target', operator: '=', value: nodeDef.id },
                    { attribute: 'processDef', operator: '=', value: processDef.id }
                ]
            });
            if (flowsOut && flowsOut.length > 1 && flowsIn && flowsIn.length === 1) {
                const follow = [];
                for (let i = 0; i < flowsOut.data.length; i++) {
                    const flow = flowsOut.data[i];
                    if (flow.condition) {
                        const processToken = yield this.getProcessToken();
                        const tokenData = processToken.data || {};
                        let result = false;
                        try {
                            const functionString = 'return ' + flow.condition;
                            const evaluateFunction = new Function(functionString);
                            result = evaluateFunction.call(tokenData);
                        }
                        catch (err) {
                        }
                        if (result) {
                            follow.push(flow.id);
                        }
                    }
                    else {
                        follow.push(flow.id);
                    }
                }
                this.follow = follow;
            }
            if (flowsIn && flowsIn.length > 1 && flowsOut && flowsOut.length === 1) {
            }
            this.state = 'progress';
            yield this.save(internalContext);
            yield this.changeState(context, 'end', this);
        });
    }
}
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.object })
], ExclusiveGatewayEntity.prototype, "follow", null);
exports.ExclusiveGatewayEntity = ExclusiveGatewayEntity;

//# sourceMappingURL=exclusive_gateway.js.map
