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
        step((generator = generator.apply(thisArg, _arguments || [])).next());
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
var ProcessEntity = (function (_super) {
    __extends(ProcessEntity, _super);
    function ProcessEntity(datastoreService, iamService, nodeInstanceEntityTypeService, propertyBagFactory, encryptionService, invoker, entityType, context, schema) {
        var _this = _super.call(this, propertyBagFactory, encryptionService, invoker, entityType, context, schema) || this;
        _this._datastoreService = undefined;
        _this._iamService = undefined;
        _this._nodeInstanceEntityTypeService = undefined;
        _this._datastoreService = datastoreService;
        _this._iamService = iamService;
        _this._nodeInstanceEntityTypeService = nodeInstanceEntityTypeService;
        return _this;
    }
    Object.defineProperty(ProcessEntity.prototype, "datastoreService", {
        get: function () {
            return this._datastoreService;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(ProcessEntity.prototype, "iamService", {
        get: function () {
            return this._iamService;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(ProcessEntity.prototype, "nodeInstanceEntityTypeService", {
        get: function () {
            return this._nodeInstanceEntityTypeService;
        },
        enumerable: true,
        configurable: true
    });
    ProcessEntity.prototype.initialize = function (derivedClassInstance) {
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
    Object.defineProperty(ProcessEntity.prototype, "name", {
        get: function () {
            return this.getProperty(this, 'name');
        },
        set: function (value) {
            this.setProperty(this, 'name', value);
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(ProcessEntity.prototype, "key", {
        get: function () {
            return this.getProperty(this, 'key');
        },
        set: function (value) {
            this.setProperty(this, 'key', value);
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(ProcessEntity.prototype, "processDef", {
        get: function () {
            return this.getProperty(this, 'processDef');
        },
        set: function (value) {
            this.setProperty(this, 'processDef', value);
        },
        enumerable: true,
        configurable: true
    });
    ProcessEntity.prototype.getProcessDef = function () {
        return this.getPropertyLazy(this, 'processDef');
    };
    ProcessEntity.prototype.start = function (context, params, options) {
        return __awaiter(this, void 0, void 0, function () {
            var source, initialToken, ProcessToken, NodeDef, StartEvent, internalContext, laneContext, participant, processDef, queryObject, startEventDef, processToken, startEvent;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        source = params ? params.source : undefined;
                        initialToken = params ? params.initialToken : undefined;
                        return [4 /*yield*/, this.datastoreService.getEntityType('ProcessToken')];
                    case 1:
                        ProcessToken = _a.sent();
                        return [4 /*yield*/, this.datastoreService.getEntityType('NodeDef')];
                    case 2:
                        NodeDef = _a.sent();
                        return [4 /*yield*/, this.datastoreService.getEntityType('StartEvent')];
                    case 3:
                        StartEvent = _a.sent();
                        return [4 /*yield*/, this.iamService.createInternalContext('processengine_system')];
                    case 4:
                        internalContext = _a.sent();
                        laneContext = context;
                        participant = (source && source.id) ? source.id : null;
                        return [4 /*yield*/, this.getProcessDef()];
                    case 5:
                        processDef = _a.sent();
                        queryObject = [
                            { attribute: 'type', operator: '=', value: 'bpmn:StartEvent' },
                            { attribute: 'processDef', operator: '=', value: processDef.id }
                        ];
                        return [4 /*yield*/, NodeDef.findOne(internalContext, { query: queryObject })];
                    case 6:
                        startEventDef = _a.sent();
                        if (!startEventDef) return [3 /*break*/, 12];
                        return [4 /*yield*/, ProcessToken.createEntity(internalContext)];
                    case 7:
                        processToken = _a.sent();
                        processToken.process = this;
                        if (initialToken) {
                            processToken.data = {
                                current: initialToken
                            };
                        }
                        return [4 /*yield*/, processToken.save(internalContext)];
                    case 8:
                        _a.sent();
                        return [4 /*yield*/, this.nodeInstanceEntityTypeService.createNode(internalContext, StartEvent)];
                    case 9:
                        startEvent = _a.sent();
                        startEvent.name = startEventDef.name;
                        startEvent.key = startEventDef.key;
                        startEvent.process = this;
                        startEvent.nodeDef = startEventDef;
                        startEvent.type = startEventDef.type;
                        startEvent.processToken = processToken;
                        startEvent.participant = participant;
                        return [4 /*yield*/, startEvent.save(internalContext)];
                    case 10:
                        _a.sent();
                        return [4 /*yield*/, startEvent.changeState(laneContext, 'start', this)];
                    case 11:
                        _a.sent();
                        _a.label = 12;
                    case 12: return [2 /*return*/];
                }
            });
        });
    };
    return ProcessEntity;
}(data_model_contracts_1.Entity));
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.string })
], ProcessEntity.prototype, "name", null);
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.string })
], ProcessEntity.prototype, "key", null);
__decorate([
    metadata_1.schemaAttribute({ type: 'ProcessDef' })
], ProcessEntity.prototype, "processDef", null);
exports.ProcessEntity = ProcessEntity;

//# sourceMappingURL=process.js.map
