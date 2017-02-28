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
    }
    start(context, params, options) {
        return __awaiter(this, void 0, void 0, function* () {
            const source = params ? params.source : undefined;
            const initialToken = params ? params.initialToken : undefined;
            const ProcessToken = yield this.datastoreService.getEntityType('ProcessToken');
            const NodeDef = yield this.datastoreService.getEntityType('NodeDef');
            const StartEvent = yield this.datastoreService.getEntityType('StartEvent');
            const internalContext = yield this.iamService.createInternalContext('processengine_system');
            let laneContext = context;
            const participant = (source && source.id) ? source.id : null;
            const processDef = yield this.getProcessDef();
            const queryObject = [
                { attribute: 'type', operator: '=', value: 'bpmn:StartEvent' },
                { attribute: 'processDef', operator: '=', value: processDef.id }
            ];
            const startEventDef = yield NodeDef.findOne(internalContext, { query: queryObject });
            if (startEventDef) {
                const processToken = yield ProcessToken.createEntity(internalContext);
                processToken.process = this;
                if (initialToken) {
                    processToken.data = {
                        current: initialToken
                    };
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
