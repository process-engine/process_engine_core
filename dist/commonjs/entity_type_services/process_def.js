"use strict";
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
var process_engine_contracts_1 = require("@process-engine-js/process_engine_contracts");
var fs = require("fs");
var BluebirdPromise = require("bluebird");
var BpmnModdle = require("bpmn-moddle");
var ProcessDefEntityTypeService = (function () {
    function ProcessDefEntityTypeService(dataModel, invoker) {
        this._dataModel = undefined;
        this._invoker = undefined;
        this._dataModel = dataModel;
        this._invoker = invoker;
    }
    Object.defineProperty(ProcessDefEntityTypeService.prototype, "dataModel", {
        get: function () {
            return this._dataModel;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(ProcessDefEntityTypeService.prototype, "invoker", {
        get: function () {
            return this._invoker;
        },
        enumerable: true,
        configurable: true
    });
    ProcessDefEntityTypeService.prototype.importBpmnFromFile = function (path) {
        return __awaiter(this, void 0, void 0, function () {
            var bpmnDiagram;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.parseBpmnFile(path)];
                    case 1:
                        bpmnDiagram = _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    ProcessDefEntityTypeService.prototype.importBpmnFromXml = function (xml, context) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            var typeName, bpmnDiagram, processDefEntityType, processes;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        typeName = 'ProcessDef';
                        return [4 /*yield*/, this.parseBpmnXml(xml)];
                    case 1:
                        bpmnDiagram = _a.sent();
                        return [4 /*yield*/, this.dataModel.getEntityType(typeName)];
                    case 2:
                        processDefEntityType = _a.sent();
                        processes = bpmnDiagram.getProcesses();
                        processes.forEach(function (process) { return __awaiter(_this, void 0, void 0, function () {
                            var processDefEntity, processDefData;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, processDefEntityType.getById(process.id, context)];
                                    case 1:
                                        processDefEntity = _a.sent();
                                        if (!processDefEntity) {
                                            processDefData = {
                                                key: process.id,
                                                defId: bpmnDiagram.definitions.id
                                            };
                                            processDefEntity = processDefEntityType.createEntity(context, processDefData);
                                        }
                                        processDefEntity.name = process.name;
                                        processDefEntity.xml = xml;
                                        return [4 /*yield*/, processDefEntity.save(context)];
                                    case 2:
                                        _a.sent();
                                        return [4 /*yield*/, this.invoker.invoke(processDefEntity, 'updateDefinitions', context)];
                                    case 3:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); });
                        return [2 /*return*/];
                }
            });
        });
    };
    ProcessDefEntityTypeService.prototype.parseBpmnXml = function (xml) {
        var moddle = BpmnModdle();
        return new BluebirdPromise(function (resolve, reject) {
            moddle.fromXML(xml, function (error, definitions) {
                if (error) {
                    reject(error);
                }
                else {
                    var bpmnDiagram = new process_engine_contracts_1.BpmnDiagram(definitions);
                    resolve(bpmnDiagram);
                }
            });
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
    return ProcessDefEntityTypeService;
}());
exports.ProcessDefEntityTypeService = ProcessDefEntityTypeService;

//# sourceMappingURL=process_def.js.map
