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
const core_contracts_1 = require("@process-engine-js/core_contracts");
const node_instance_1 = require("./node_instance");
const metadata_1 = require("@process-engine-js/metadata");
class ParallelGatewayEntity extends node_instance_1.NodeInstanceEntity {
    constructor(nodeInstanceEntityDependencyHelper, entityDependencyHelper) {
        super(nodeInstanceEntityDependencyHelper, entityDependencyHelper);
    }
    initialize(derivedClassInstance) {
        const _super = name => super[name];
        return __awaiter(this, void 0, void 0, function* () {
            const actualInstance = derivedClassInstance || this;
            yield _super("initialize").call(this, actualInstance);
        });
    }
    get parallelType() {
        return this.getProperty(this, 'parallelType');
    }
    set parallelType(value) {
        this.setProperty(this, 'parallelType', value);
    }
    execute(context) {
        return __awaiter(this, void 0, void 0, function* () {
            const flowDefEntityType = yield this.datastoreService.getEntityType('FlowDef');
            const nodeDef = yield this.getNodeDef();
            const processDef = yield nodeDef.getProcessDef();
            const internalContext = yield this.iamService.createInternalContext('processengine_system');
            const flowsOut = yield flowDefEntityType.query(internalContext, {
                query: [
                    { attribute: 'source.id', operator: '=', value: nodeDef.id },
                    { attribute: 'processDef.id', operator: '=', value: processDef.id }
                ]
            });
            const flowsIn = yield flowDefEntityType.query(internalContext, {
                query: [
                    { attribute: 'target', operator: '=', value: nodeDef.id },
                    { attribute: 'processDef', operator: '=', value: processDef.id }
                ]
            });
            if (flowsOut && flowsOut.length > 1 && flowsIn && flowsIn.length === 1) {
                this.parallelType = 'split';
                this.state = 'progress';
                yield this.save(internalContext);
                yield this.changeState(context, 'end', this);
            }
            if (flowsIn && flowsIn.length > 1 && flowsOut && flowsOut.length === 1) {
                this.parallelType = 'join';
                this.state = 'progress';
                yield this.save(internalContext);
            }
        });
    }
    proceed(context, newData, source) {
        return __awaiter(this, void 0, void 0, function* () {
            const flowDefEntityType = yield this.datastoreService.getEntityType('FlowDef');
            const nodeDefEntityType = yield this.datastoreService.getEntityType('NodeDef');
            const sourceEntityType = yield this.datastoreService.getEntityType(source.type);
            let prevDefs = null;
            const nodeDef = yield this.getNodeDef();
            const processDef = yield nodeDef.getProcessDef();
            let flowsIn = null;
            const internalContext = yield this.iamService.createInternalContext('processengine_system');
            flowsIn = yield flowDefEntityType.query(internalContext, {
                query: [
                    { attribute: 'target', operator: '=', value: nodeDef.id },
                    { attribute: 'processDef', operator: '=', value: processDef.id }
                ]
            });
            if (flowsIn && flowsIn.length > 0) {
                const ids = [];
                for (let i = 0; i < flowsIn.entities.length; i++) {
                    const flow = flowsIn.entities[i];
                    const source = yield flow.getSource;
                    ids.push(source.id);
                }
                const queryIn = ids.map((id) => {
                    return { attribute: 'id', operator: '=', value: id };
                });
                prevDefs = yield nodeDefEntityType.query(internalContext, {
                    query: [
                        { or: queryIn },
                        { attribute: 'processDef', operator: '=', value: processDef.id }
                    ]
                });
                const keys = [];
                prevDefs.entities.forEach((prefDev) => {
                    keys.push(prefDev.key);
                });
                if (source) {
                    const sourceEntity = yield sourceEntityType.getById(source.id, internalContext);
                    const token = yield sourceEntity.getProcessToken();
                    let allthere = true;
                    const processToken = yield this.getProcessToken();
                    const tokenData = processToken.data || {};
                    tokenData.history = tokenData.history || {};
                    const merged = Object.assign({}, tokenData.history, token.data.history);
                    tokenData.history = merged;
                    processToken.data = tokenData;
                    yield processToken.save(internalContext);
                    keys.forEach((key) => {
                        if (!tokenData.history.hasOwnProperty(key)) {
                            allthere = false;
                        }
                    });
                    if (allthere) {
                        yield this.changeState(context, 'end', this);
                    }
                }
            }
        });
    }
}
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.string })
], ParallelGatewayEntity.prototype, "parallelType", null);
exports.ParallelGatewayEntity = ParallelGatewayEntity;

//# sourceMappingURL=parallel_gateway.js.map
