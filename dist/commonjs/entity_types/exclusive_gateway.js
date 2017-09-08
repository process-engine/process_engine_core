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
    constructor(nodeInstanceEntityDependencyHelper, entityDependencyHelper, context, schema, propertyBag, entityType) {
        super(nodeInstanceEntityDependencyHelper, entityDependencyHelper, context, schema, propertyBag, entityType);
    }
    async initialize() {
        await super.initialize(this);
    }
    get follow() {
        return this.getProperty(this, 'follow');
    }
    set follow(value) {
        this.setProperty(this, 'follow', value);
    }
    async execute(context) {
        const nodeDef = this.nodeDef;
        const processDef = this.process.processDef;
        let flowsOut = [];
        for (let i = 0; i < processDef.flowDefCollection.data.length; i++) {
            const flowDef = processDef.flowDefCollection.data[i];
            if (flowDef.source.id === nodeDef.id) {
                flowsOut.push(flowDef);
            }
        }
        let flowsIn = [];
        for (let i = 0; i < processDef.flowDefCollection.data.length; i++) {
            const flowDef = processDef.flowDefCollection.data[i];
            if (flowDef.target.id === nodeDef.id) {
                flowsIn.push(flowDef);
            }
        }
        if (flowsOut && flowsOut.length > 1 && flowsIn && flowsIn.length === 1) {
            const follow = [];
            for (let i = 0; i < flowsOut.length; i++) {
                const flow = flowsOut[i];
                if (flow.condition) {
                    const processToken = this.processToken;
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
        this.changeState(context, 'end', this);
    }
}
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.object })
], ExclusiveGatewayEntity.prototype, "follow", null);
exports.ExclusiveGatewayEntity = ExclusiveGatewayEntity;

//# sourceMappingURL=exclusive_gateway.js.map
