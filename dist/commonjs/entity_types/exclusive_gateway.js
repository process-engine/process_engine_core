"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_instance_1 = require("./node_instance");
const core_contracts_1 = require("@process-engine-js/core_contracts");
const metadata_1 = require("@process-engine-js/metadata");
class ExclusiveGatewayEntity extends node_instance_1.NodeInstanceEntity {
    constructor(nodeInstanceEntityDependencyHelper, entityDependencyHelper, context, schema) {
        super(nodeInstanceEntityDependencyHelper, entityDependencyHelper, context, schema);
    }
    async initialize(derivedClassInstance) {
        const actualInstance = derivedClassInstance || this;
        await super.initialize(actualInstance);
    }
    get follow() {
        return this.getProperty(this, 'follow');
    }
    set follow(value) {
        this.setProperty(this, 'follow', value);
    }
    async execute(context) {
        const flowDefEntityType = await this.datastoreService.getEntityType('FlowDef');
        const internalContext = await this.iamService.createInternalContext('processengine_system');
        const nodeDef = await this.getNodeDef(internalContext);
        const processDef = await nodeDef.getProcessDef(internalContext);
        const queryObjectOut = {
            operator: 'and',
            queries: [
                { attribute: 'source', operator: '=', value: nodeDef.id },
                { attribute: 'processDef', operator: '=', value: processDef.id }
            ]
        };
        const flowsOut = await flowDefEntityType.query(internalContext, { query: queryObjectOut });
        const queryObjectIn = {
            operator: 'and',
            queries: [
                { attribute: 'target', operator: '=', value: nodeDef.id },
                { attribute: 'processDef', operator: '=', value: processDef.id }
            ]
        };
        const flowsIn = await flowDefEntityType.query(internalContext, { query: queryObjectIn });
        if (flowsOut && flowsOut.length > 1 && flowsIn && flowsIn.length === 1) {
            const follow = [];
            for (let i = 0; i < flowsOut.data.length; i++) {
                const flow = flowsOut.data[i];
                if (flow.condition) {
                    const processToken = await this.getProcessToken(internalContext);
                    const tokenData = processToken.data || {};
                    let result = false;
                    try {
                        const functionString = 'return ' + flow.condition;
                        const evaluateFunction = new Function('token', functionString);
                        result = evaluateFunction.call(tokenData, tokenData);
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
        await this.save(internalContext);
        this.changeState(context, 'end', this);
    }
}
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.object })
], ExclusiveGatewayEntity.prototype, "follow", null);
exports.ExclusiveGatewayEntity = ExclusiveGatewayEntity;

//# sourceMappingURL=exclusive_gateway.js.map
