"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
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
        step((generator = generator.apply(thisArg, _arguments)).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t;
    return { next: verb(0), "throw": verb(1), "return": verb(2) };
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = y[op[0] & 2 ? "return" : op[0] ? "throw" : "next"]) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [0, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var core_contracts_1 = require("@process-engine-js/core_contracts");
var data_model_contracts_1 = require("@process-engine-js/data_model_contracts");
var metadata_1 = require("@process-engine-js/metadata");
var NodeDefEntity = (function (_super) {
    __extends(NodeDefEntity, _super);
    function NodeDefEntity(propertyBagFactory, invoker, entityType, context, schema) {
        return _super.call(this, propertyBagFactory, invoker, entityType, context, schema) || this;
    }
    NodeDefEntity.prototype.initialize = function (derivedClassInstance) {
        return __awaiter(this, void 0, void 0, function () {
            var actualInstance;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        actualInstance = derivedClassInstance || this;
                        return [4 /*yield*/, _super.prototype.initialize.call(this, actualInstance)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    Object.defineProperty(NodeDefEntity.prototype, "name", {
        get: function () {
            return this.getProperty(this, 'name');
        },
        set: function (value) {
            this.setProperty(this, 'name', value);
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(NodeDefEntity.prototype, "key", {
        get: function () {
            return this.getProperty(this, 'key');
        },
        set: function (value) {
            this.setProperty(this, 'key', value);
        },
        enumerable: true,
        configurable: true
    });
    NodeDefEntity.prototype.processDef = function () {
        return this.getProperty(this, 'processDef');
    };
    NodeDefEntity.prototype.getProcessDef = function () {
        return this.getPropertyLazy(this, 'processDef');
    };
    NodeDefEntity.prototype.setProcessDef = function (value) {
        this.setProperty(this, 'processDef', value);
    };
    NodeDefEntity.prototype.getLane = function () {
        return this.getPropertyLazy(this, 'lane');
    };
    NodeDefEntity.prototype.setLane = function (value) {
        this.setProperty(this, 'lane', value);
    };
    Object.defineProperty(NodeDefEntity.prototype, "type", {
        get: function () {
            return this.getProperty(this, 'type');
        },
        set: function (value) {
            this.setProperty(this, 'type', value);
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(NodeDefEntity.prototype, "extensions", {
        get: function () {
            return this.getProperty(this, 'extensions');
        },
        set: function (value) {
            this.setProperty(this, 'extensions', value);
        },
        enumerable: true,
        configurable: true
    });
    NodeDefEntity.prototype.getAttachedToNode = function () {
        return this.getPropertyLazy(this, 'attachedToNode');
    };
    NodeDefEntity.prototype.setAttachedToNode = function (value) {
        this.setProperty(this, 'attachedToNode', value);
    };
    Object.defineProperty(NodeDefEntity.prototype, "events", {
        get: function () {
            return this.getProperty(this, 'events');
        },
        set: function (value) {
            this.setProperty(this, 'events', value);
        },
        enumerable: true,
        configurable: true
    });
    NodeDefEntity.prototype.getLaneRole = function (context) {
        return __awaiter(this, void 0, void 0, function () {
            var lane, extensions, properties, found;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getLane()];
                    case 1:
                        lane = _a.sent();
                        extensions = lane.extensions;
                        properties = (extensions && extensions.properties) ? extensions.properties : null;
                        found = null;
                        if (properties) {
                            properties.some(function (property) {
                                if (property.name === 'role') {
                                    found = property.value;
                                    return true;
                                }
                            });
                        }
                        return [2 /*return*/, found];
                }
            });
        });
    };
    return NodeDefEntity;
}(data_model_contracts_1.Entity));
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.string })
], NodeDefEntity.prototype, "name", null);
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.string })
], NodeDefEntity.prototype, "key", null);
__decorate([
    metadata_1.schemaAttribute({ type: 'ProcessDef' })
], NodeDefEntity.prototype, "processDef", null);
__decorate([
    metadata_1.schemaAttribute({ type: 'Lane' })
], NodeDefEntity.prototype, "getLane", null);
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.string })
], NodeDefEntity.prototype, "type", null);
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.object })
], NodeDefEntity.prototype, "extensions", null);
__decorate([
    metadata_1.schemaAttribute({ type: 'NodeDef' })
], NodeDefEntity.prototype, "getAttachedToNode", null);
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.string })
], NodeDefEntity.prototype, "events", null);
exports.NodeDefEntity = NodeDefEntity;

//# sourceMappingURL=node_def.js.map
