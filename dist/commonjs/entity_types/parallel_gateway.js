"use strict";
var __assign = (this && this.__assign) || Object.assign || function(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
    }
    return t;
};
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
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
            this.parallelType = 'split';
            this.state = 'progress';
            await this.save(internalContext);
            await this.changeState(context, 'end', this);
        }
        if (flowsIn && flowsIn.length > 1 && flowsOut && flowsOut.length === 1) {
            this.parallelType = 'join';
            this.state = 'progress';
            await this.save(internalContext);
        }
    }
    async proceed(context, newData, source, applicationId) {
        const internalContext = await this.iamService.createInternalContext('processengine_system');
        const flowDefEntityType = await this.datastoreService.getEntityType('FlowDef');
        const nodeDefEntityType = await this.datastoreService.getEntityType('NodeDef');
        const sourceEntityType = await this.datastoreService.getEntityType(source._meta.type);
        let prevDefs = null;
        const nodeDef = await this.getNodeDef(internalContext);
        const processDef = await nodeDef.getProcessDef(internalContext);
        let flowsIn = null;
        const queryObjectAll = {
            operator: 'and',
            queries: [
                { attribute: 'target', operator: '=', value: nodeDef.id },
                { attribute: 'processDef', operator: '=', value: processDef.id }
            ]
        };
        flowsIn = await flowDefEntityType.query(internalContext, { query: queryObjectAll });
        if (flowsIn && flowsIn.length > 0) {
            const ids = [];
            for (let i = 0; i < flowsIn.data.length; i++) {
                const flow = flowsIn.data[i];
                const source = await flow.getSource(internalContext);
                ids.push(source.id);
            }
            const queryObjectDefs = {
                operator: 'and',
                queries: [
                    { attribute: 'id', operator: 'in', value: ids },
                    { attribute: 'processDef', operator: '=', value: processDef.id }
                ]
            };
            prevDefs = await nodeDefEntityType.query(internalContext, { query: queryObjectDefs });
            const keys = [];
            prevDefs.data.forEach((prefDev) => {
                keys.push(prefDev.key);
            });
            if (source) {
                const sourceEntity = await sourceEntityType.getById(source.id, internalContext);
                const token = await sourceEntity.getProcessToken(internalContext);
                let allthere = true;
                const processToken = await this.getProcessToken(internalContext);
                const tokenData = processToken.data || {};
                tokenData.history = tokenData.history || {};
                const merged = __assign({}, tokenData.history, token.data.history);
                tokenData.history = merged;
                processToken.data = tokenData;
                await processToken.save(internalContext);
                keys.forEach((key) => {
                    if (!tokenData.history.hasOwnProperty(key)) {
                        allthere = false;
                    }
                });
                if (allthere) {
                    await this.changeState(context, 'end', this);
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
