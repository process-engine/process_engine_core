"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
const core_contracts_1 = require("@process-engine-js/core_contracts");
const data_model_contracts_1 = require("@process-engine-js/data_model_contracts");
const metadata_1 = require("@process-engine-js/metadata");
class ProcessTokenEntity extends data_model_contracts_1.Entity {
    constructor(entityDependencyHelper, context, schema) {
        super(entityDependencyHelper, context, schema);
    }
    async initialize(derivedClassInstance) {
        const actualInstance = derivedClassInstance || this;
        await super.initialize(actualInstance);
    }
    get data() {
        return this.getProperty(this, 'data');
    }
    set data(value) {
        this.setProperty(this, 'data', value);
    }
    get process() {
        return this.getProperty(this, 'process');
    }
    set process(value) {
        this.setProperty(this, 'process', value);
    }
    getProcess(context) {
        return this.getPropertyLazy(this, 'process', context);
    }
}
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.object })
], ProcessTokenEntity.prototype, "data", null);
__decorate([
    metadata_1.schemaAttribute({ type: 'Process' })
], ProcessTokenEntity.prototype, "process", null);
exports.ProcessTokenEntity = ProcessTokenEntity;

//# sourceMappingURL=process_token.js.map
