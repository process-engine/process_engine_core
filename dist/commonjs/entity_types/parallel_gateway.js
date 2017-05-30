"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
const core_contracts_1 = require("@process-engine-js/core_contracts");
const node_instance_1 = require("./node_instance");
const metadata_1 = require("@process-engine-js/metadata");
class ParallelGatewayEntity extends node_instance_1.NodeInstanceEntity {
    constructor(nodeInstanceEntityDependencyHelper, entityDependencyHelper, context, schema) {
        super(nodeInstanceEntityDependencyHelper, entityDependencyHelper, context, schema);
    }
    async initialize(derivedClassInstance) {
        const actualInstance = derivedClassInstance || this;
        await super.initialize(actualInstance);
    }
    get parallelType() {
        return this.getProperty(this, 'parallelType');
    }
    set parallelType(value) {
        this.setProperty(this, 'parallelType', value);
    }
    async execute(context) {
        const nodeDef = await this.nodeDef;
        const processDef = await this.process.processDef;
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
            // split
            this.parallelType = 'split';
            // do nothing, just change to end
            this.state = 'progress';
            this.changeState(context, 'end', this);
        }
        if (flowsIn && flowsIn.length > 1 && flowsOut && flowsOut.length === 1) {
            // join
            this.parallelType = 'join';
            // we have to wait for all incoming flows
            this.state = 'wait';
            if (this.process.processDef.persist) {
                const internalContext = await this.iamService.createInternalContext('processengine_system');
                await this.save(internalContext, { reloadAfterSave: false });
            }
        }
    }
    async proceed(context, newData, source, applicationId) {
        // check if all tokens are there
        const nodeDef = this.nodeDef;
        const processDef = this.process.processDef;
        const prevDefsKeys = [];
        for (let i = 0; i < processDef.flowDefCollection.data.length; i++) {
            const flowDef = processDef.flowDefCollection.data[i];
            if (flowDef.target.id === nodeDef.id) {
                const sourceDefId = flowDef.source.id;
                for (let j = 0; j < processDef.nodeDefCollection.data.length; j++) {
                    const sourceDef = processDef.nodeDefCollection.data[j];
                    if (sourceDef.id === sourceDefId) {
                        prevDefsKeys.push(sourceDef.key);
                    }
                }
            }
        }
        if (prevDefsKeys.length > 0) {
            if (source) {
                const token = await source.processToken;
                let allthere = true;
                const processToken = this.processToken;
                const tokenData = processToken.data || {};
                tokenData.history = tokenData.history || {};
                // merge tokens
                const merged = Object.assign({}, tokenData.history, token.data.history);
                tokenData.history = merged;
                processToken.data = tokenData;
                prevDefsKeys.forEach((key) => {
                    if (!tokenData.history.hasOwnProperty(key)) {
                        allthere = false;
                    }
                });
                if (allthere) {
                    // end
                    this.changeState(context, 'end', this);
                }
                else {
                    if (this.process.processDef.persist) {
                        const internalContext = await this.iamService.createInternalContext('processengine_system');
                        await processToken.save(internalContext, { reloadAfterSave: false });
                    }
                }
            }
        }
    }
}
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.string })
], ParallelGatewayEntity.prototype, "parallelType", null);
exports.ParallelGatewayEntity = ParallelGatewayEntity;

//# sourceMappingURL=parallel_gateway.js.map
