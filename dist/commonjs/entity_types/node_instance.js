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
var NodeInstanceEntity = (function (_super) {
    __extends(NodeInstanceEntity, _super);
    function NodeInstanceEntity(nodeInstanceHelper, propertyBagFactory, encryptionService, invoker, entityType, context, schema) {
        var _this = _super.call(this, propertyBagFactory, encryptionService, invoker, entityType, context, schema) || this;
        _this._helper = undefined;
        _this._helper = nodeInstanceHelper;
        return _this;
    }
    Object.defineProperty(NodeInstanceEntity.prototype, "helper", {
        get: function () {
            return this._helper;
        },
        enumerable: true,
        configurable: true
    });
    NodeInstanceEntity.prototype.initialize = function (derivedClassInstance) {
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
    Object.defineProperty(NodeInstanceEntity.prototype, "name", {
        get: function () {
            return this.getProperty(this, 'name');
        },
        set: function (value) {
            this.setProperty(this, 'name', value);
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(NodeInstanceEntity.prototype, "key", {
        get: function () {
            return this.getProperty(this, 'key');
        },
        set: function (value) {
            this.setProperty(this, 'key', value);
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(NodeInstanceEntity.prototype, "process", {
        get: function () {
            return this.getProperty(this, 'process');
        },
        set: function (value) {
            this.setProperty(this, 'process', value);
        },
        enumerable: true,
        configurable: true
    });
    NodeInstanceEntity.prototype.getProcess = function () {
        return this.getPropertyLazy(this, 'process');
    };
    Object.defineProperty(NodeInstanceEntity.prototype, "nodeDef", {
        get: function () {
            return this.getProperty(this, 'nodeDef');
        },
        set: function (value) {
            this.setProperty(this, 'nodeDef', value);
        },
        enumerable: true,
        configurable: true
    });
    NodeInstanceEntity.prototype.getNodeDef = function () {
        return this.getPropertyLazy(this, 'nodeDef');
    };
    Object.defineProperty(NodeInstanceEntity.prototype, "type", {
        get: function () {
            return this.getProperty(this, 'type');
        },
        set: function (value) {
            this.setProperty(this, 'type', value);
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(NodeInstanceEntity.prototype, "state", {
        get: function () {
            return this.getProperty(this, 'state');
        },
        set: function (value) {
            this.setProperty(this, 'state', value);
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(NodeInstanceEntity.prototype, "participant", {
        get: function () {
            return this.getProperty(this, 'participant');
        },
        set: function (value) {
            this.setProperty(this, 'participant', value);
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(NodeInstanceEntity.prototype, "processToken", {
        get: function () {
            return this.getProperty(this, 'processToken');
        },
        set: function (value) {
            this.setProperty(this, 'processToken', value);
        },
        enumerable: true,
        configurable: true
    });
    NodeInstanceEntity.prototype.getProcessToken = function () {
        return this.getPropertyLazy(this, 'processToken');
    };
    NodeInstanceEntity.prototype.createNode = function (context) {
        return __awaiter(this, void 0, void 0, function () {
            function nodeHandler(msg) {
                return __awaiter(this, void 0, void 0, function () {
                    var action, source, context, newState, _a, newData, event_1, data;
                    return __generator(this, function (_b) {
                        switch (_b.label) {
                            case 0: return [4 /*yield*/, this.messagebus.verifyMessage(msg)];
                            case 1:
                                msg = _b.sent();
                                action = (msg && msg.data && msg.data.action) ? msg.data.action : null;
                                source = (msg && msg.origin) ? msg.origin : null;
                                context = (msg && msg.meta && msg.meta.context) ? msg.meta.context : {};
                                if (!(action === 'changeState'))
                                    return [3 /*break*/, 8];
                                newState = (msg && msg.data && msg.data.data) ? msg.data.data : null;
                                _a = newState;
                                switch (_a) {
                                    case ('start'): return [3 /*break*/, 2];
                                    case ('execute'): return [3 /*break*/, 4];
                                    case ('end'): return [3 /*break*/, 6];
                                }
                                return [3 /*break*/, 8];
                            case 2: return [4 /*yield*/, this.entity.start(context, source)];
                            case 3:
                                _b.sent();
                                return [3 /*break*/, 8];
                            case 4: return [4 /*yield*/, this.entity.execute(context)];
                            case 5:
                                _b.sent();
                                return [3 /*break*/, 8];
                            case 6: return [4 /*yield*/, this.entity.end(context)];
                            case 7:
                                _b.sent();
                                return [3 /*break*/, 8];
                            case 8:
                                if (!(action === 'proceed'))
                                    return [3 /*break*/, 10];
                                newData = (msg && msg.data && msg.data.token) ? msg.data.token : null;
                                return [4 /*yield*/, this.entity.proceed(context, newData, source)];
                            case 9:
                                _b.sent();
                                _b.label = 10;
                            case 10:
                                if (!(action === 'event'))
                                    return [3 /*break*/, 12];
                                event_1 = (msg && msg.data && msg.data.event) ? msg.data.event : null;
                                data = (msg && msg.data && msg.data.data) ? msg.data.data : null;
                                return [4 /*yield*/, this.entity.event(context, event_1, data)];
                            case 11:
                                _b.sent();
                                _b.label = 12;
                            case 12: return [2 /*return*/];
                        }
                    });
                });
            }
            var internalContext, NodeInstance, node, binding;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.helper.iamService.createInternalContext('processengine_system')];
                    case 1:
                        internalContext = _a.sent();
                        return [4 /*yield*/, this.helper.datastoreService.getEntityType('NodeInstance')];
                    case 2:
                        NodeInstance = _a.sent();
                        return [4 /*yield*/, NodeInstance.createEntity(internalContext)];
                    case 3:
                        node = _a.sent();
                        binding = {
                            entity: node,
                            messagebus: this.helper.messagebusService
                        };
                        return [4 /*yield*/, this.helper.messagebusService.subscribe('/processengine/node/' + node.id, nodeHandler.bind(binding))];
                    case 4:
                        _a.sent();
                        return [2 /*return*/, node];
                }
            });
        });
    };
    NodeInstanceEntity.prototype.getLaneRole = function (context) {
        return __awaiter(this, void 0, void 0, function () {
            var nodeDef, role;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.nodeDef];
                    case 1:
                        nodeDef = _a.sent();
                        return [4 /*yield*/, nodeDef.getLaneRole(context)];
                    case 2:
                        role = _a.sent();
                        return [2 /*return*/, role];
                }
            });
        });
    };
    NodeInstanceEntity.prototype.start = function (context, source) {
        return __awaiter(this, void 0, void 0, function () {
            var role, internalContext;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getLaneRole(context)];
                    case 1:
                        role = _a.sent();
                        if (role !== null) {
                        }
                        if (!this.state) {
                            this.state = 'start';
                        }
                        return [4 /*yield*/, this.helper.iamService.createInternalContext('processengine_system')];
                    case 2:
                        internalContext = _a.sent();
                        return [4 /*yield*/, this.save(internalContext)];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, this.changeState(context, 'execute', this)];
                    case 4:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    NodeInstanceEntity.prototype.changeState = function (context, newState, source) {
        return __awaiter(this, void 0, void 0, function () {
            var meta, data, origin, msg;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        meta = {
                            jwt: context.encryptedToken
                        };
                        data = {
                            action: 'changeState',
                            data: newState
                        };
                        origin = new data_model_contracts_1.EntityReference(source.entityType.namespace, source.entityType.name, source.id);
                        msg = this.helper.messagebusService.createMessage(data, origin, meta);
                        return [4 /*yield*/, this.helper.messagebusService.publish('/processengine/node/' + this.id, msg)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    return NodeInstanceEntity;
}(data_model_contracts_1.Entity));
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.string })
], NodeInstanceEntity.prototype, "name", null);
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.string })
], NodeInstanceEntity.prototype, "key", null);
__decorate([
    metadata_1.schemaAttribute({ type: 'Process' })
], NodeInstanceEntity.prototype, "process", null);
__decorate([
    metadata_1.schemaAttribute({ type: 'NodeDef' })
], NodeInstanceEntity.prototype, "nodeDef", null);
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.string })
], NodeInstanceEntity.prototype, "type", null);
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.string })
], NodeInstanceEntity.prototype, "state", null);
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.string })
], NodeInstanceEntity.prototype, "participant", null);
__decorate([
    metadata_1.schemaAttribute({ type: 'ProcessToken' })
], NodeInstanceEntity.prototype, "processToken", null);
NodeInstanceEntity = __decorate([
    metadata_1.schemaClass({
        expand: [
            { attribute: 'nodeDef', depth: 2 },
            { attribute: 'processToken', depth: 2 }
        ]
    })
], NodeInstanceEntity);
exports.NodeInstanceEntity = NodeInstanceEntity;

//# sourceMappingURL=node_instance.js.map
