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
class ProcessEntity extends data_model_contracts_1.Entity {
    constructor(iamService, nodeInstanceEntityTypeService, entityDependencyHelper) {
        super(entityDependencyHelper);
        this._iamService = undefined;
        this._nodeInstanceEntityTypeService = undefined;
        this._iamService = iamService;
        this._nodeInstanceEntityTypeService = nodeInstanceEntityTypeService;
    }
    get iamService() {
        return this._iamService;
    }
    get nodeInstanceEntityTypeService() {
        return this._nodeInstanceEntityTypeService;
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
                yield processToken.save(internalContext);
                const startEvent = yield this.nodeInstanceEntityTypeService.createNode(internalContext, StartEvent);
                startEvent.name = startEventDef.name;
                startEvent.key = startEventDef.key;
                startEvent.process = this;
                startEvent.nodeDef = startEventDef;
                startEvent.type = startEventDef.type;
                startEvent.processToken = processToken;
                startEvent.participant = participant;
                yield startEvent.save(internalContext);
                yield startEvent.changeState(laneContext, 'start', this);
            }
        });
    }
}
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
