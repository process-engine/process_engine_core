"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
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
var node_instance_1 = require("./node_instance");
var metadata_1 = require("@process-engine-js/metadata");
var ParallelGatewayEntity = (function (_super) {
    __extends(ParallelGatewayEntity, _super);
    function ParallelGatewayEntity(nodeInstanceHelper, propertyBagFactory, encryptionService, invoker, entityType, context, schema) {
        return _super.call(this, nodeInstanceHelper, propertyBagFactory, encryptionService, invoker, entityType, context, schema) || this;
    }
    ParallelGatewayEntity.prototype.initialize = function (derivedClassInstance) {
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
    Object.defineProperty(ParallelGatewayEntity.prototype, "parallelType", {
        get: function () {
            return this.getProperty(this, 'parallelType');
        },
        set: function (value) {
            this.setProperty(this, 'parallelType', value);
        },
        enumerable: true,
        configurable: true
    });
    ParallelGatewayEntity.prototype.execute = function (context) {
        return __awaiter(this, void 0, void 0, function () {
            var flowDefEntityType, nodeDef, processDef, internalContext, flowsOut, flowsIn;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.helper.datastoreService.getEntityType('FlowDef')];
                    case 1:
                        flowDefEntityType = _a.sent();
                        return [4 /*yield*/, this.getNodeDef()];
                    case 2:
                        nodeDef = _a.sent();
                        return [4 /*yield*/, nodeDef.getProcessDef()];
                    case 3:
                        processDef = _a.sent();
                        return [4 /*yield*/, this.helper.iamService.createInternalContext('processengine_system')];
                    case 4:
                        internalContext = _a.sent();
                        return [4 /*yield*/, flowDefEntityType.query(internalContext, {
                                query: [
                                    { attribute: 'source.id', operator: '=', value: nodeDef.id },
                                    { attribute: 'processDef.id', operator: '=', value: processDef.id }
                                ]
                            })];
                    case 5:
                        flowsOut = _a.sent();
                        return [4 /*yield*/, flowDefEntityType.query(internalContext, {
                                query: [
                                    { attribute: 'target', operator: '=', value: nodeDef.id },
                                    { attribute: 'processDef', operator: '=', value: processDef.id }
                                ]
                            })];
                    case 6:
                        flowsIn = _a.sent();
                        if (!(flowsOut && flowsOut.length > 1 && flowsIn && flowsIn.length === 1))
                            return [3 /*break*/, 9];
                        this.parallelType = 'split';
                        this.state = 'progress';
                        return [4 /*yield*/, this.save(internalContext)];
                    case 7:
                        _a.sent();
                        return [4 /*yield*/, this.changeState(context, 'end', this)];
                    case 8:
                        _a.sent();
                        _a.label = 9;
                    case 9:
                        if (!(flowsIn && flowsIn.length > 1 && flowsOut && flowsOut.length === 1))
                            return [3 /*break*/, 11];
                        this.parallelType = 'join';
                        this.state = 'progress';
                        return [4 /*yield*/, this.save(internalContext)];
                    case 10:
                        _a.sent();
                        _a.label = 11;
                    case 11: return [2 /*return*/];
                }
            });
        });
    };
    ParallelGatewayEntity.prototype.proceed = function (context, newData, source) {
        return __awaiter(this, void 0, void 0, function () {
            var flowDefEntityType, nodeDefEntityType, sourceEntityType, prevDefs, nodeDef, processDef, flowsIn, internalContext, ids, i, flow, source_1, queryIn, keys_1, sourceEnt, token, allthere_1, processToken, tokenData_1, merged;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.helper.datastoreService.getEntityType('FlowDef')];
                    case 1:
                        flowDefEntityType = _a.sent();
                        return [4 /*yield*/, this.helper.datastoreService.getEntityType('NodeDef')];
                    case 2:
                        nodeDefEntityType = _a.sent();
                        return [4 /*yield*/, this.helper.datastoreService.getEntityType(source.type)];
                    case 3:
                        sourceEntityType = _a.sent();
                        prevDefs = null;
                        return [4 /*yield*/, this.getNodeDef()];
                    case 4:
                        nodeDef = _a.sent();
                        return [4 /*yield*/, nodeDef.getProcessDef()];
                    case 5:
                        processDef = _a.sent();
                        flowsIn = null;
                        return [4 /*yield*/, this.helper.iamService.createInternalContext('processengine_system')];
                    case 6:
                        internalContext = _a.sent();
                        return [4 /*yield*/, flowDefEntityType.query(internalContext, {
                                query: [
                                    { attribute: 'target', operator: '=', value: nodeDef.id },
                                    { attribute: 'processDef', operator: '=', value: processDef.id }
                                ]
                            })];
                    case 7:
                        flowsIn = _a.sent();
                        if (!(flowsIn && flowsIn.length > 0))
                            return [3 /*break*/, 18];
                        ids = [];
                        i = 0;
                        _a.label = 8;
                    case 8:
                        if (!(i < flowsIn.entities.length))
                            return [3 /*break*/, 11];
                        flow = flowsIn.entities[i];
                        return [4 /*yield*/, flow.getSource];
                    case 9:
                        source_1 = _a.sent();
                        ids.push(source_1.id);
                        _a.label = 10;
                    case 10:
                        i++;
                        return [3 /*break*/, 8];
                    case 11:
                        queryIn = ids.map(function (id) {
                            return { attribute: 'id', operator: '=', value: id };
                        });
                        return [4 /*yield*/, nodeDefEntityType.query(internalContext, {
                                query: [
                                    { or: queryIn },
                                    { attribute: 'processDef', operator: '=', value: processDef.id }
                                ]
                            })];
                    case 12:
                        prevDefs = _a.sent();
                        keys_1 = [];
                        prevDefs.entities.forEach(function (prefDev) {
                            keys_1.push(prefDev.key);
                        });
                        if (!source)
                            return [3 /*break*/, 18];
                        return [4 /*yield*/, sourceEntityType.getById(source.id, internalContext)];
                    case 13:
                        sourceEnt = _a.sent();
                        return [4 /*yield*/, sourceEnt.getProcessToken];
                    case 14:
                        token = _a.sent();
                        allthere_1 = true;
                        return [4 /*yield*/, this.getProcessToken()];
                    case 15:
                        processToken = _a.sent();
                        tokenData_1 = processToken.data || {};
                        tokenData_1.history = tokenData_1.history || {};
                        merged = __assign({}, tokenData_1.history, token.data.history);
                        tokenData_1.history = merged;
                        processToken.data = tokenData_1;
                        return [4 /*yield*/, processToken.save(internalContext)];
                    case 16:
                        _a.sent();
                        keys_1.forEach(function (key) {
                            if (!tokenData_1.history.hasOwnProperty(key)) {
                                allthere_1 = false;
                            }
                        });
                        if (!allthere_1)
                            return [3 /*break*/, 18];
                        return [4 /*yield*/, this.changeState(context, 'end', this)];
                    case 17:
                        _a.sent();
                        _a.label = 18;
                    case 18: return [2 /*return*/];
                }
            });
        });
    };
    return ParallelGatewayEntity;
}(node_instance_1.NodeInstanceEntity));
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.string })
], ParallelGatewayEntity.prototype, "parallelType", null);
exports.ParallelGatewayEntity = ParallelGatewayEntity;

//# sourceMappingURL=parallel_gateway.js.map
