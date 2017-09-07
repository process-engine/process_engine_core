var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
define(["require", "exports", "@process-engine-js/core_contracts", "@process-engine-js/data_model_contracts", "@process-engine-js/metadata"], function (require, exports, core_contracts_1, data_model_contracts_1, metadata_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class ProcessTokenEntity extends data_model_contracts_1.Entity {
        constructor(entityDependencyHelper, context, schema, propertyBag, entityType) {
            super(entityDependencyHelper, context, schema, propertyBag, entityType);
        }
        async initialize() {
            await super.initialize(this);
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
});

//# sourceMappingURL=process_token.js.map
