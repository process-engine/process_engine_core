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
class ScriptTaskEntity extends node_instance_1.NodeInstanceEntity {
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
    get script() {
        return this.getProperty(this, 'script');
    }
    set script(value) {
        this.setProperty(this, 'script', value);
    }
    execute(context) {
        return __awaiter(this, void 0, void 0, function* () {
            const internalContext = yield this.iamService.createInternalContext('processengine_system');
            this.state = 'progress';
            yield this.save(internalContext);
            const processToken = yield this.getProcessToken();
            const tokenData = processToken.data || {};
            let result;
            const nodeDef = yield this.getNodeDef();
            const script = nodeDef.script;
            if (script) {
                try {
                    const scriptFunction = new Function('token', 'context', script);
                    result = yield scriptFunction.call(this, tokenData, context);
                }
            });
        });
    };
    Object.defineProperty(ScriptTaskEntity.prototype, "script", {
        get: function () {
            return this.getProperty(this, 'script');
        },
        set: function (value) {
            this.setProperty(this, 'script', value);
        },
        enumerable: true,
        configurable: true
    });
    ScriptTaskEntity.prototype.execute = function (context) {
        return __awaiter(this, void 0, void 0, function () {
            var internalContext, processToken, tokenData, result, nodeDef, script, scriptFunction, err_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.helper.iamService.createInternalContext('processengine_system')];
                    case 1:
                        internalContext = _a.sent();
                        this.state = 'progress';
                        return [4 /*yield*/, this.save(internalContext)];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, this.getProcessToken()];
                    case 3:
                        processToken = _a.sent();
                        tokenData = processToken.data || {};
                        return [4 /*yield*/, this.getNodeDef()];
                    case 4:
                        nodeDef = _a.sent();
                        script = nodeDef.script;
                        if (!script) return [3 /*break*/, 11];
                        _a.label = 5;
                    case 5:
                        _a.trys.push([5, 7, , 9]);
                        scriptFunction = new Function('token', 'context', script);
                        return [4 /*yield*/, scriptFunction.call(this, tokenData, context)];
                    case 6:
                        result = _a.sent();
                        return [3 /*break*/, 9];
                    case 7:
                        err_1 = _a.sent();
                        result = err_1;
                        return [4 /*yield*/, this.error(context, err_1)];
                    case 8:
                        _a.sent();
                        return [3 /*break*/, 9];
                    case 9:
                        tokenData.current = result;
                        processToken.data = tokenData;
                        return [4 /*yield*/, processToken.save(context)];
                    case 10:
                        _a.sent();
                        _a.label = 11;
                    case 11: return [4 /*yield*/, this.changeState(context, 'end', this)];
                    case 12:
                        _a.sent();
                        return [2 /*return*/];
                }
                tokenData.current = result;
                processToken.data = tokenData;
                yield processToken.save(context);
            }
            yield this.changeState(context, 'end', this);
        });
    }
}
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.string })
], ScriptTaskEntity.prototype, "script", null);
exports.ScriptTaskEntity = ScriptTaskEntity;

//# sourceMappingURL=script_task.js.map
