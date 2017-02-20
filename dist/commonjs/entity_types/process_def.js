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
var uuid = require("uuid");
;
var ProcessDefEntity = (function (_super) {
    __extends(ProcessDefEntity, _super);
    function ProcessDefEntity(processDefEntityTypeService, datastoreService, propertyBagFactory, encryptionService, invoker, entityType, context, schema) {
        var _this = _super.call(this, propertyBagFactory, encryptionService, invoker, entityType, context, schema) || this;
        _this._processDefEntityTypeService = undefined;
        _this._datastoreService = undefined;
        _this._processDefEntityTypeService = processDefEntityTypeService;
        _this._datastoreService = datastoreService;
        return _this;
    }
    ProcessDefEntity.prototype.initialize = function (derivedClassInstance) {
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
    Object.defineProperty(ProcessDefEntity.prototype, "processDefEntityTypeService", {
        get: function () {
            return this._processDefEntityTypeService;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(ProcessDefEntity.prototype, "datastoreService", {
        get: function () {
            return this._datastoreService;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(ProcessDefEntity.prototype, "name", {
        get: function () {
            return this.getProperty(this, 'name');
        },
        set: function (value) {
            this.setProperty(this, 'name', value);
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(ProcessDefEntity.prototype, "key", {
        get: function () {
            return this.getProperty(this, 'key');
        },
        set: function (value) {
            this.setProperty(this, 'key', value);
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(ProcessDefEntity.prototype, "defId", {
        get: function () {
            return this.getProperty(this, 'defId');
        },
        set: function (value) {
            this.setProperty(this, 'defId', value);
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(ProcessDefEntity.prototype, "xml", {
        get: function () {
            return this.getProperty(this, 'xml');
        },
        set: function (value) {
            this.setProperty(this, 'xml', value);
        },
        enumerable: true,
        configurable: true
    });
    ProcessDefEntity.prototype.start = function (context, params, options) {
        return __awaiter(this, void 0, void 0, function () {
            var processData, processEntityType, processEntity;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        processData = {
                            key: this.key,
                            processDef: this
                        };
                        return [4 /*yield*/, this.datastoreService.getEntityType('Process')];
                    case 1:
                        processEntityType = _a.sent();
                        return [4 /*yield*/, processEntityType.createEntity(context, processData)];
                    case 2:
                        processEntity = (_a.sent());
                        return [4 /*yield*/, processEntity.save(context)];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, this.invoker.invoke(processEntity, 'start', context, context, params, options)];
                    case 4:
                        _a.sent();
                        return [2 /*return*/, processEntity];
                }
            });
        });
    };
    ProcessDefEntity.prototype.updateBpmn = function (context, params) {
        return __awaiter(this, void 0, void 0, function () {
            var xml;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        xml = params && params.xml ? params.xml : null;
                        if (!xml)
                            return [3 /*break*/, 3];
                        this.xml = xml;
                        return [4 /*yield*/, this.save(context)];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, this.updateDefinitions(context)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/, { result: true }];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    ProcessDefEntity.prototype.updateDefinitions = function (context, params) {
        return __awaiter(this, void 0, void 0, function () {
            var bpmnDiagram, xml, key, lanes, laneCache, nodes, nodeCache, flows;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        bpmnDiagram = params && params.bpmnDiagram ? params.bpmnDiagram : null;
                        xml = this.xml;
                        key = this.key;
                        if (!!bpmnDiagram)
                            return [3 /*break*/, 2];
                        return [4 /*yield*/, this.processDefEntityTypeService.parseBpmnXml(xml)];
                    case 1:
                        bpmnDiagram = _a.sent();
                        _a.label = 2;
                    case 2:
                        lanes = bpmnDiagram.getLanes(key);
                        return [4 /*yield*/, this._updateLanes(lanes, context)];
                    case 3:
                        laneCache = _a.sent();
                        nodes = bpmnDiagram.getNodes(key);
                        return [4 /*yield*/, this._updateNodes(nodes, laneCache, bpmnDiagram, context)];
                    case 4:
                        nodeCache = _a.sent();
                        return [4 /*yield*/, this._createBoundaries(nodes, nodeCache, context)];
                    case 5:
                        _a.sent();
                        flows = bpmnDiagram.getFlows(key);
                        return [4 /*yield*/, this._updateFlows(flows, nodeCache, context)];
                    case 6:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    ProcessDefEntity.prototype._updateLanes = function (lanes, context) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            var laneCache, Lane, lanePromiseArray;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        laneCache = {};
                        return [4 /*yield*/, this.datastoreService.getEntityType('Lane')];
                    case 1:
                        Lane = _a.sent();
                        lanePromiseArray = lanes.map(function (lane) { return __awaiter(_this, void 0, void 0, function () {
                            var queryObject, queryOptions, laneEntity, laneData;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        queryObject = [
                                            { attribute: 'key', operator: '=', value: lane.id },
                                            { attribute: 'processDef', operator: '=', value: this.id }
                                        ];
                                        queryOptions = {
                                            query: queryObject
                                        };
                                        return [4 /*yield*/, Lane.findOne(context, queryOptions)];
                                    case 1:
                                        laneEntity = _a.sent();
                                        if (!!laneEntity)
                                            return [3 /*break*/, 3];
                                        laneData = {
                                            key: lane.id
                                        };
                                        return [4 /*yield*/, Lane.createEntity(context, laneData)];
                                    case 2:
                                        laneEntity = _a.sent();
                                        _a.label = 3;
                                    case 3:
                                        laneEntity.name = lane.name;
                                        laneEntity.processDef = this;
                                        return [4 /*yield*/, laneEntity.save(context)];
                                    case 4:
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
            var nodeCache, NodeDef, nodePromiseArray;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        nodeCache = {};
                        return [4 /*yield*/, this.datastoreService.getEntityType('NodeDef')];
                    case 1:
                        NodeDef = _a.sent();
                        nodePromiseArray = nodes.map(function (node) { return __awaiter(_this, void 0, void 0, function () {
                            var queryObject, nodeDefEntity, nodeDefData, eventType, subElements, subNodes, subFlows, extensions, laneId;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        queryObject = [
                                            { attribute: 'key', operator: '=', value: node.id },
                                            { attribute: 'processDef', operator: '=', value: this.id }
                                        ];
                                        return [4 /*yield*/, NodeDef.findOne(context, { query: queryObject })];
                                    case 1:
                                        nodeDefEntity = _a.sent();
                                        if (!!nodeDefEntity)
                                            return [3 /*break*/, 3];
                                        nodeDefData = {
                                            key: node.id
                                        };
                                        return [4 /*yield*/, NodeDef.createEntity(context, nodeDefData)];
                                    case 2:
                                        nodeDefEntity = _a.sent();
                                        _a.label = 3;
                                    case 3:
                                        switch (node.$type) {
                                            case 'bpmn:ScriptTask':
                                                nodeDefEntity.script = node.script || null;
                                                break;
                                            case 'bpmn:BoundaryEvent':
                                                eventType = (node.eventDefinitions && node.eventDefinitions.length > 0) ? node.eventDefinitions[0].$type : null;
                                                if (eventType) {
                                                    nodeDefEntity.eventType = eventType;
                                                    nodeDefEntity.cancelActivity = node.cancelActivity || true;
                                                }
                                                break;
                                            case 'bpmn:CallActivity':
                                                if (node.calledElement) {
                                                    nodeDefEntity.subProcessKey = node.calledElement;
                                                }
                                                break;
                                            case 'bpmn:SubProcess':
                                                subElements = node.flowElements ? node.flowElements : [];
                                                subNodes = subElements.filter(function (element) { return element.$type !== 'bpmn:SequenceFlow'; });
                                                subFlows = subElements.filter(function (element) { return element.$type === 'bpmn:SequenceFlow'; });
                                                break;
                                            default:
                                        }
                                        if (node.extensionElements) {
                                            extensions = this._updateExtensionElements(node.extensionElements.values);
                                            nodeDefEntity.extensions = extensions;
                                        }
                                        nodeDefEntity.name = node.name;
                                        nodeDefEntity.type = node.$type;
                                        nodeDefEntity.processDef = this;
                                        laneId = bpmnDiagram.getLaneOfElement(node.id);
                                        if (laneId) {
                                            nodeDefEntity.lane = laneCache[laneId];
                                        }
                                        return [4 /*yield*/, nodeDefEntity.save(context)];
                                    case 4:
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
            var FlowDef, flowPromiseArray;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.datastoreService.getEntityType('FlowDef')];
                    case 1:
                        FlowDef = _a.sent();
                        flowPromiseArray = flows.map(function (flow) { return __awaiter(_this, void 0, void 0, function () {
                            var queryObject, flowDefEntity, flowDefData, sourceId, targetId;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        queryObject = [
                                            { attribute: 'key', operator: '=', value: flow.id },
                                            { attribute: 'processDef', operator: '=', value: this.id }
                                        ];
                                        return [4 /*yield*/, FlowDef.findOne(context, { query: queryObject })];
                                    case 1:
                                        flowDefEntity = _a.sent();
                                        if (!!flowDefEntity)
                                            return [3 /*break*/, 3];
                                        flowDefData = {
                                            key: flow.id
                                        };
                                        return [4 /*yield*/, FlowDef.createEntity(context, flowDefData)];
                                    case 2:
                                        flowDefEntity = _a.sent();
                                        _a.label = 3;
                                    case 3:
                                        flowDefEntity.name = flow.name;
                                        flowDefEntity.processDef = this;
                                        if (flow.sourceRef && flow.sourceRef.id) {
                                            sourceId = flow.sourceRef.id;
                                            flowDefEntity.source = nodeCache[sourceId];
                                        }
                                        if (flow.targetRef && flow.targetRef.id) {
                                            targetId = flow.targetRef.id;
                                            flowDefEntity.target = nodeCache[targetId];
                                        }
                                        if (flow.conditionExpression && flow.conditionExpression.body) {
                                            flowDefEntity.condition = flow.conditionExpression.body;
                                        }
                                        return [4 /*yield*/, flowDefEntity.save(context)];
                                    case 4:
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
    ProcessDefEntity.prototype._createBoundaries = function (nodes, nodeCache, context) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            var nodePromiseArray;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        nodePromiseArray = nodes.map(function (node) { return __awaiter(_this, void 0, void 0, function () {
                            var attachedKey, sourceEnt, boundary, events;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        if (!(node.$type === 'bpmn:BoundaryEvent'))
                                            return [3 /*break*/, 3];
                                        attachedKey = (node.attachedToRef && node.attachedToRef.id) ? node.attachedToRef.id : null;
                                        if (!attachedKey)
                                            return [3 /*break*/, 3];
                                        sourceEnt = nodeCache[attachedKey];
                                        boundary = nodeCache[node.id];
                                        boundary.attachedToNode = sourceEnt;
                                        return [4 /*yield*/, boundary.save(context)];
                                    case 1:
                                        _a.sent();
                                        events = sourceEnt.events || {};
                                        switch (boundary.eventType) {
                                            case 'bpmn:ErrorEventDefinition':
                                                events.error = boundary.key;
                                                break;
                                            default:
                                        }
                                        sourceEnt.events = events;
                                        return [4 /*yield*/, sourceEnt.save(context)];
                                    case 2:
                                        _a.sent();
                                        _a.label = 3;
                                    case 3: return [2 /*return*/];
                                }
                            });
                        }); });
                        return [4 /*yield*/, Promise.all(nodePromiseArray)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    ProcessDefEntity.prototype._updateExtensionElements = function (extensionElements) {
        var ext = {};
        extensionElements.forEach(function (extensionElement) {
            if (extensionElement.$type === 'camunda:formData') {
                var formFields_1 = [];
                extensionElement.$children.forEach(function (child) {
                    var formValues = [];
                    var formProperties = [];
                    child.$children.forEach(function (formValue) {
                        var childType = formValue.$type;
                        switch (childType) {
                            case 'camunda:properties':
                                formValue.$children.forEach(function (child) {
                                    var newChild = {
                                        $type: child.$type,
                                        name: child.id,
                                        value: child.value
                                    };
                                    formProperties.push(newChild);
                                });
                                break;
                            case 'camunda:value':
                                var newFormValue = {
                                    $type: formValue.$type,
                                    id: formValue.id,
                                    name: formValue.name
                                };
                                formValues.push(newFormValue);
                                break;
                            default:
                                break;
                        }
                    });
                    var newChild = {
                        $type: child.$type,
                        id: child.id,
                        label: child.label,
                        type: child.type,
                        defaultValue: child.defaultValue,
                        formValues: formValues,
                        formProperties: formProperties
                    };
                    formFields_1.push(newChild);
                });
                ext.formFields = formFields_1;
            }
            else if (extensionElement.$type === 'camunda:properties') {
                var properties_1 = [];
                extensionElement.$children.forEach(function (child) {
                    var newChild = {
                        $type: child.$type,
                        name: child.name,
                        value: child.value
                    };
                    properties_1.push(newChild);
                });
                ext.properties = properties_1;
            }
        });
        return ext;
    };
    return ProcessDefEntity;
}(data_model_contracts_1.Entity));
__decorate([
    metadata_1.schemaAttribute({
        type: core_contracts_1.SchemaAttributeType.string,
        onInit: function () {
            return uuid.v4();
        }
    })
], ProcessDefEntity.prototype, "name", null);
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.string })
], ProcessDefEntity.prototype, "key", null);
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.string })
], ProcessDefEntity.prototype, "defId", null);
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.string })
], ProcessDefEntity.prototype, "xml", null);
exports.ProcessDefEntity = ProcessDefEntity;

//# sourceMappingURL=process_def.js.map
