"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const process_engine_contracts_1 = require("@process-engine-js/process_engine_contracts");
const fs = require("fs");
const BluebirdPromise = require("bluebird");
const BpmnModdle = require("bpmn-moddle");
class ProcessDefEntityTypeService {
    constructor(datastoreService, invoker) {
        this._datastoreService = undefined;
        this._invoker = undefined;
        this._datastoreService = datastoreService;
        this._invoker = invoker;
    }
    get datastoreService() {
        return this._datastoreService;
    }
    get invoker() {
        return this._invoker;
    }
    importBpmnFromFile(context, params, options) {
        const self = this;
        const fileName = params && params.file ? params.file : null;
        if (fileName) {
            const path = process.cwd() + '/examples/bpmns/' + fileName;
            return new BluebirdPromise((resolve, reject) => {
                fs.readFile(path, 'utf8', (error, xmlString) => __awaiter(this, void 0, void 0, function* () {
                    if (error) {
                        reject(error);
                    }
                    else {
                        return self.importBpmnFromXml(context, { xml: xmlString }, options);
                    }
                }));
            })
                .then(() => {
                return { result: true };
            });
        }
        return BluebirdPromise.reject(new Error('file does not exist'));
    };
    ProcessDefEntityTypeService.prototype.importBpmnFromXml = function (context, params, options) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            var xml, bpmnDiagram_1, ProcessDef_1, processes;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        xml = params && params.xml ? params.xml : null;
                        if (!xml) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.parseBpmnXml(xml)];
                    case 1:
                        bpmnDiagram_1 = _a.sent();
                        return [4 /*yield*/, this.datastoreService.getEntityType('ProcessDef')];
                    case 2:
                        ProcessDef_1 = _a.sent();
                        processes = bpmnDiagram_1.getProcesses();
                        processes.forEach(function (process) { return __awaiter(_this, void 0, void 0, function () {
                            var queryObject, params, processDefColl, processDefEntity, processDefData;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        queryObject = {
                                            attribute: 'key',
                                            operator: '=',
                                            value: process.id
                                        };
                                        params = { query: queryObject };
                                        return [4 /*yield*/, ProcessDef_1.query(context, params)];
                                    case 1:
                                        processDefColl = _a.sent();
                                        processDefEntity = processDefColl && processDefColl.length > 0 ? processDefColl.data[0] : null;
                                        if (!!processDefEntity) return [3 /*break*/, 3];
                                        processDefData = {
                                            key: process.id,
                                            defId: bpmnDiagram_1.definitions.id
                                        };
                                        return [4 /*yield*/, ProcessDef_1.createEntity(context, processDefData)];
                                    case 2:
                                        processDefEntity = _a.sent();
                                        _a.label = 3;
                                    case 3:
                                        processDefEntity.name = process.name;
                                        processDefEntity.xml = xml;
                                        return [4 /*yield*/, processDefEntity.save(context)];
                                    case 4:
                                        _a.sent();
                                        return [4 /*yield*/, this.invoker.invoke(processDefEntity, 'updateDefinitions', context, context, { bpmnDiagram: bpmnDiagram_1 })];
                                    case 5:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); });
                        _a.label = 3;
                    case 3: return [2 /*return*/];
                }
                else {
                    const bpmnDiagram = new process_engine_contracts_1.BpmnDiagram(definitions);
                    resolve(bpmnDiagram);
                }
            });
        });
    }
    parseBpmnFile(path) {
        return new BluebirdPromise((resolve, reject) => {
            fs.readFile(path, 'utf8', (error, xmlString) => __awaiter(this, void 0, void 0, function* () {
                if (error) {
                    reject(error);
                }
                else {
                    const definitions = yield this.parseBpmnXml(xmlString);
                    const bpmnDiagram = new process_engine_contracts_1.BpmnDiagram(definitions);
                    resolve(bpmnDiagram);
                }
            }));
        });
    };
    ProcessDefEntityTypeService.prototype.parseBpmnFile = function (path) {
        var _this = this;
        return new BluebirdPromise(function (resolve, reject) {
            fs.readFile(path, 'utf8', function (error, xmlString) { return __awaiter(_this, void 0, void 0, function () {
                var definitions, bpmnDiagram;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (!error) return [3 /*break*/, 1];
                            reject(error);
                            return [3 /*break*/, 3];
                        case 1: return [4 /*yield*/, this.parseBpmnXml(xmlString)];
                        case 2:
                            definitions = _a.sent();
                            bpmnDiagram = new process_engine_contracts_1.BpmnDiagram(definitions);
                            resolve(bpmnDiagram);
                            _a.label = 3;
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
        });
    };
    ProcessDefEntityTypeService.prototype.start = function (context, params, options) {
        return __awaiter(this, void 0, void 0, function () {
            var key, ProcessDef, queryObject, queryParams, processDefEntity, processEntity;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        key = params ? params.key : undefined;
                        if (!key) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.datastoreService.getEntityType('ProcessDef')];
                    case 1:
                        ProcessDef = _a.sent();
                        queryObject = {
                            attribute: 'key',
                            operator: '=',
                            value: key
                        };
                        queryParams = { query: queryObject };
                        return [4 /*yield*/, ProcessDef.findOne(context, queryParams)];
                    case 2:
                        processDefEntity = _a.sent();
                        if (!processDefEntity) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.invoker.invoke(processDefEntity, 'start', context, context, params, options)];
                    case 3:
                        processEntity = _a.sent();
                        return [2 /*return*/, processEntity];
                    case 4: return [2 /*return*/, null];
                }
            }
            return null;
        });
    }
}
exports.ProcessDefEntityTypeService = ProcessDefEntityTypeService;

//# sourceMappingURL=process_def.js.map
