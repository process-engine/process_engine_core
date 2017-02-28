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
const data_model_contracts_1 = require("@process-engine-js/data_model_contracts");
const metadata_1 = require("@process-engine-js/metadata");
class FlowDefEntity extends data_model_contracts_1.Entity {
    constructor(entityDependencyHelper) {
        super(entityDependencyHelper);
    }
    initialize(derivedClassInstance) {
        const _super = name => super[name];
        return __awaiter(this, void 0, void 0, function* () {
            const actualInstance = derivedClassInstance || this;
            yield _super("initialize").call(this, actualInstance);
        });
    }
    get name() {
        return this.getProperty(this, 'name');
    }
    set name(value) {
        this.setProperty(this, 'name', value);
    }
    get key() {
        return this.getProperty(this, 'key');
    }
    set key(value) {
        this.setProperty(this, 'key', value);
    }
    get processDef() {
        return this.getProperty(this, 'processDef');
    }
    set processDef(value) {
        this.setProperty(this, 'processDef', value);
    }
    getProcessDef() {
        return this.getPropertyLazy(this, 'processDef');
    }
    get source() {
        return this.getProperty(this, 'source');
    }
    set source(value) {
        this.setProperty(this, 'source', value);
    }
    getSource() {
        return this.getPropertyLazy(this, 'source');
    }
    get target() {
        return this.getProperty(this, 'target');
    }
    set target(value) {
        this.setProperty(this, 'target', value);
    }
    getTarget() {
        return this.getPropertyLazy(this, 'target');
    }
    get condition() {
        return this.getProperty(this, 'condition');
    }
    set condition(value) {
        this.setProperty(this, 'condition', value);
    }
}
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.string })
], FlowDefEntity.prototype, "name", null);
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.string })
], FlowDefEntity.prototype, "key", null);
__decorate([
    metadata_1.schemaAttribute({ type: 'ProcessDef' })
], FlowDefEntity.prototype, "processDef", null);
__decorate([
    metadata_1.schemaAttribute({ type: 'NodeDef' })
], FlowDefEntity.prototype, "source", null);
__decorate([
    metadata_1.schemaAttribute({ type: 'NodeDef' })
], FlowDefEntity.prototype, "target", null);
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.string })
], FlowDefEntity.prototype, "condition", null);
exports.FlowDefEntity = FlowDefEntity;

//# sourceMappingURL=flow_def.js.map
