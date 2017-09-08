var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
define(["require", "exports", "@process-engine-js/core_contracts", "./node_instance", "@process-engine-js/metadata"], function (require, exports, core_contracts_1, node_instance_1, metadata_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class ScriptTaskEntity extends node_instance_1.NodeInstanceEntity {
        constructor(nodeInstanceEntityDependencyHelper, entityDependencyHelper, context, schema, propertyBag, entityType) {
            super(nodeInstanceEntityDependencyHelper, entityDependencyHelper, context, schema, propertyBag, entityType);
        }
        async initialize() {
            await super.initialize(this);
        }
        get script() {
            return this.getProperty(this, 'script');
        }
        set script(value) {
            this.setProperty(this, 'script', value);
        }
        async execute(context) {
            this.state = 'progress';
            const processToken = this.processToken;
            const tokenData = processToken.data || {};
            let result;
            const nodeDef = this.nodeDef;
            const script = nodeDef.script;
            if (script) {
                try {
                    const scriptFunction = new Function('token', 'context', script);
                    result = await scriptFunction.call(this, tokenData, context);
                }
                catch (err) {
                    result = err;
                    this.error(context, err);
                }
                let finalResult = result;
                const toPojoOptions = { skipCalculation: true };
                if (result && typeof result.toPojos === 'function') {
                    finalResult = await result.toPojos(context, toPojoOptions);
                }
                else if (result && typeof result.toPojo === 'function') {
                    finalResult = await result.toPojo(context, toPojoOptions);
                }
                tokenData.current = finalResult;
                processToken.data = tokenData;
            }
            this.changeState(context, 'end', this);
        }
    }
    __decorate([
        metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.string })
    ], ScriptTaskEntity.prototype, "script", null);
    exports.ScriptTaskEntity = ScriptTaskEntity;
});

//# sourceMappingURL=script_task.js.map
