"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
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
var data_model_contracts_1 = require("data_model_contracts");
;
var ProcessDefEntity = (function (_super) {
    __extends(ProcessDefEntity, _super);
    function ProcessDefEntity(processDefEntityTypeService, dataModel, propertyBagFactory, invoker, entityType, context, schemas) {
        var _this = _super.call(this, propertyBagFactory, invoker, entityType, context, schemas) || this;
        _this._processDefEntityTypeService = undefined;
        _this._dataModel = undefined;
        _this._processDefEntityTypeService = processDefEntityTypeService;
        _this._dataModel = dataModel;
        return _this;
    }
    Object.defineProperty(ProcessDefEntity.prototype, "processDefEntityTypeService", {
        get: function () {
            return this._processDefEntityTypeService;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(ProcessDefEntity.prototype, "dataModel", {
        get: function () {
            return this._dataModel;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(ProcessDefEntity.prototype, "xml", {
        get: function () {
            return this.getProperty(this, 'xml');
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(ProcessDefEntity.prototype, "key", {
        get: function () {
            return this.getProperty(this, 'key');
        },
        enumerable: true,
        configurable: true
    });
    ProcessDefEntity.prototype.start = function (context) {
        return __awaiter(this, void 0, void 0, function () {
            var typeName, processData, processEntityType, processEntity;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        typeName = 'Process';
                        processData = {
                            key: this.key,
                            processDef: this
                        };
                        return [4 /*yield*/, this.dataModel.getEntityType(typeName)];
                    case 1:
                        processEntityType = _a.sent();
                        processEntity = processEntityType.createEntity(context, processData);
                        return [4 /*yield*/, processEntity.save(context)];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, this.invoker.invoke(processEntity, 'start', context)];
                    case 3:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    ProcessDefEntity.prototype.updateDefinitions = function (context, newBpmnDiagram) {
        return __awaiter(this, void 0, void 0, function () {
            var bpmnDiagram, lanes, laneCache, nodes, nodeCache, flows;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        bpmnDiagram = newBpmnDiagram;
                        if (!!bpmnDiagram) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.processDefEntityTypeService.parseBpmnXml(this.xml)];
                    case 1:
                        bpmnDiagram = _a.sent();
                        _a.label = 2;
                    case 2:
                        lanes = bpmnDiagram.getLanes(this.key);
                        return [4 /*yield*/, this._updateLanes(lanes, context)];
                    case 3:
                        laneCache = _a.sent();
                        nodes = bpmnDiagram.getNodes(this.key);
                        return [4 /*yield*/, this._updateNodes(nodes, laneCache, bpmnDiagram, context)];
                    case 4:
                        nodeCache = _a.sent();
                        flows = bpmnDiagram.getFlows(this.key);
                        return [4 /*yield*/, this._updateFlows(flows, nodeCache, context)];
                    case 5:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    ProcessDefEntity.prototype._updateLanes = function (lanes, context) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            var laneCache, typeName, laneEntityType, lanePromiseArray;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        laneCache = {};
                        typeName = 'Lane';
                        return [4 /*yield*/, this.dataModel.getEntityType(typeName)];
                    case 1:
                        laneEntityType = _a.sent();
                        lanePromiseArray = lanes.map(function (lane) { return __awaiter(_this, void 0, void 0, function () {
                            var queryObject, laneEntity, laneData;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        queryObject = [
                                            { attribute: 'key', operator: '=', value: lane.id },
                                            { attribute: 'processDef.key', operator: '=', value: this.key }
                                        ];
                                        return [4 /*yield*/, laneEntityType.findOne(context, { query: queryObject })];
                                    case 1:
                                        laneEntity = _a.sent();
                                        if (!laneEntity) {
                                            laneData = {
                                                key: lane.id
                                            };
                                            laneEntity = laneEntityType.createEntity(context, laneData);
                                        }
                                        laneEntity.name = lane.name;
                                        laneEntity.processDef = this;
                                        return [4 /*yield*/, laneEntity.save(context)];
                                    case 2:
                                        _a.sent();
                                        laneCache[lane.id] = laneEntity;
                                        return [2 /*return*/];
                                }
                            });
                        }); });
                        return [4 /*yield*/, Promise.all(lanePromiseArray)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/, laneCache];
                }
            });
        });
    };
    ProcessDefEntity.prototype._updateNodes = function (nodes, laneCache, bpmnDiagram, context) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            var nodeCache, typeName, nodeDefEntityType, nodePromiseArray;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        nodeCache = {};
                        typeName = 'NodeDef';
                        return [4 /*yield*/, this.dataModel.getEntityType(typeName)];
                    case 1:
                        nodeDefEntityType = _a.sent();
                        nodePromiseArray = nodes.map(function (node) { return __awaiter(_this, void 0, void 0, function () {
                            var queryObject, nodeDefEntity, nodeDefData, extensions, laneId;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        queryObject = [
                                            { attribute: 'key', operator: '=', value: node.id },
                                            { attribute: 'processDef.key', operator: '=', value: this.key }
                                        ];
                                        return [4 /*yield*/, nodeDefEntityType.findOne(context, { query: queryObject })];
                                    case 1:
                                        nodeDefEntity = _a.sent();
                                        if (!nodeDefEntity) {
                                            nodeDefData = {
                                                key: node.id
                                            };
                                            nodeDefEntity = nodeDefEntityType.createEntity(context, nodeDefData);
                                        }
                                        if (node.extensionElements) {
                                            extensions = this._updateExtensionElements(node.extensionElements.values);
                                            nodeDefEntity.extensions = extensions;
                                        }
                                        nodeDefEntity.name = node.name;
                                        nodeDefEntity.type = node['$type'];
                                        nodeDefEntity.processDef = this;
                                        laneId = bpmnDiagram.getLaneOfElement(node.id);
                                        if (laneId) {
                                            nodeDefEntity.lane = laneCache[laneId];
                                        }
                                        return [4 /*yield*/, nodeDefEntity.save(context)];
                                    case 2:
                                        _a.sent();
                                        nodeCache[node.id] = nodeDefEntity;
                                        return [2 /*return*/];
                                }
                            });
                        }); });
                        return [4 /*yield*/, Promise.all(nodePromiseArray)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/, nodeCache];
                }
            });
        });
    };
    ProcessDefEntity.prototype._updateFlows = function (flows, nodeCache, context) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            var typeName, flowDefEntityType, flowPromiseArray;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        typeName = 'FlowDef';
                        return [4 /*yield*/, this.dataModel.getEntityType(typeName)];
                    case 1:
                        flowDefEntityType = _a.sent();
                        flowPromiseArray = flows.map(function (flow) { return __awaiter(_this, void 0, void 0, function () {
                            var queryObject, flowDefEntity, flowDefData, sourceId, targetId;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        queryObject = [
                                            { attribute: 'key', operator: '=', value: flow.id },
                                            { attribute: 'processDef.key', operator: '=', value: this.key }
                                        ];
                                        return [4 /*yield*/, flowDefEntityType.findOne(context, { query: queryObject })];
                                    case 1:
                                        flowDefEntity = _a.sent();
                                        if (!flowDefEntity) {
                                            flowDefData = {
                                                key: flow.id
                                            };
                                            flowDefEntity = flowDefEntityType.createEntity(context, flowDefData);
                                        }
                                        flowDefEntity.name = flow.name;
                                        flowDefEntity.processDef = this;
                                        sourceId = flow.sourceRef.id;
                                        flowDefEntity.source = nodeCache[sourceId];
                                        targetId = flow.targetRef.id;
                                        flowDefEntity.target = nodeCache[targetId];
                                        if (flow.conditionExpression && flow.conditionExpression.body) {
                                            flowDefEntity.condition = flow.conditionExpression.body;
                                        }
                                        return [4 /*yield*/, flowDefEntity.save(context)];
                                    case 2:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); });
                        return [4 /*yield*/, Promise.all(flowPromiseArray)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    ProcessDefEntity.prototype._updateExtensionElements = function (extensionElements) {
        var ext = {};
        extensionElements.forEach(function (extensionElement) {
            if (extensionElement['$type'] === 'camunda:formData') {
                var formFields_1 = [];
                extensionElement['$children'].forEach(function (child) {
                    var formValues = [];
                    var formProperties = [];
                    child['$children'].forEach(function (formValue) {
                        var childType = formValue['$type'];
                        switch (childType) {
                            case 'camunda:properties':
                                formValue['$children'].forEach(function (child) {
                                    var newChild = (_a = {},
                                        _a['$type'] = child['$type'],
                                        _a.name = child.id,
                                        _a.value = child.value,
                                        _a);
                                    formProperties.push(newChild);
                                    var _a;
                                });
                                break;
                            case 'camunda:value':
                                var newFormValue = (_a = {},
                                    _a['$type'] = formValue['$type'],
                                    _a.id = formValue.id,
                                    _a.name = formValue.name,
                                    _a);
                                formValues.push(newFormValue);
                                break;
                            default:
                                break;
                        }
                        var _a;
                    });
                    var newChild = (_a = {},
                        _a['$type'] = child['$type'],
                        _a.id = child.id,
                        _a.label = child.label,
                        _a.type = child.type,
                        _a.defaultValue = child.defaultValue,
                        _a.formValues = formValues,
                        _a.formProperties = formProperties,
                        _a);
                    formFields_1.push(newChild);
                    var _a;
                });
                ext.formFields = formFields_1;
            }
            else if (extensionElement['$type'] === 'camunda:properties') {
                var properties_1 = [];
                extensionElement['$children'].forEach(function (child) {
                    var newChild = (_a = {},
                        _a['$type'] = child['$type'],
                        _a.name = child.name,
                        _a.value = child.value,
                        _a);
                    properties_1.push(newChild);
                    var _a;
                });
                ext.properties = properties_1;
            }
        });
        return ext;
    };
    return ProcessDefEntity;
}(data_model_contracts_1.Entity));
ProcessDefEntity.attributes = {
    name: { type: 'string' },
    key: { type: 'string' },
    defId: { type: 'string' },
    xml: { type: 'string' }
};
exports.ProcessDefEntity = ProcessDefEntity;

//# sourceMappingURL=process_def.js.map
