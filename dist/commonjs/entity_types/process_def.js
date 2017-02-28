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
const uuid = require("uuid");
;
class ProcessDefEntity extends data_model_contracts_1.Entity {
    constructor(processDefEntityTypeService, entityDependencyHelper) {
        super(entityDependencyHelper);
        this._processDefEntityTypeService = undefined;
        this._processDefEntityTypeService = processDefEntityTypeService;
    }
    initialize(derivedClassInstance) {
        const _super = name => super[name];
        return __awaiter(this, void 0, void 0, function* () {
            const actualInstance = derivedClassInstance || this;
            yield _super("initialize").call(this, actualInstance);
        });
    }
    get processDefEntityTypeService() {
        return this._processDefEntityTypeService;
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
    get defId() {
        return this.getProperty(this, 'defId');
    }
    set defId(value) {
        this.setProperty(this, 'defId', value);
    }
    get xml() {
        return this.getProperty(this, 'xml');
    }
    set xml(value) {
        this.setProperty(this, 'xml', value);
    }
    start(context, params, options) {
        return __awaiter(this, void 0, void 0, function* () {
            const processData = {
                key: this.key,
                processDef: this
            };
            const processEntityType = yield this.datastoreService.getEntityType('Process');
            const processEntity = (yield processEntityType.createEntity(context, processData));
            yield processEntity.save(context);
            yield this.invoker.invoke(processEntity, 'start', context, context, params, options);
            return processEntity;
        });
    }
    updateBpmn(context, params) {
        return __awaiter(this, void 0, void 0, function* () {
            const xml = params && params.xml ? params.xml : null;
            if (xml) {
                this.xml = xml;
                yield this.save(context);
                yield this.updateDefinitions(context);
                return { result: true };
            }
        });
    }
    updateDefinitions(context, params) {
        return __awaiter(this, void 0, void 0, function* () {
            let bpmnDiagram = params && params.bpmnDiagram ? params.bpmnDiagram : null;
            const xml = this.xml;
            const key = this.key;
            if (!bpmnDiagram) {
                bpmnDiagram = yield this.processDefEntityTypeService.parseBpmnXml(xml);
            }
            const lanes = bpmnDiagram.getLanes(key);
            const laneCache = yield this._updateLanes(lanes, context);
            const nodes = bpmnDiagram.getNodes(key);
            const nodeCache = yield this._updateNodes(nodes, laneCache, bpmnDiagram, context);
            yield this._createBoundaries(nodes, nodeCache, context);
            const flows = bpmnDiagram.getFlows(key);
            yield this._updateFlows(flows, nodeCache, context);
        });
    }
    _updateLanes(lanes, context) {
        return __awaiter(this, void 0, void 0, function* () {
            const laneCache = {};
            const Lane = yield this.datastoreService.getEntityType('Lane');
            const lanePromiseArray = lanes.map((lane) => __awaiter(this, void 0, void 0, function* () {
                const queryObject = [
                    { attribute: 'key', operator: '=', value: lane.id },
                    { attribute: 'processDef', operator: '=', value: this.id }
                ];
                const queryOptions = {
                    query: queryObject
                };
                let laneEntity = yield Lane.findOne(context, queryOptions);
                if (!laneEntity) {
                    const laneData = {
                        key: lane.id
                    };
                    laneEntity = yield Lane.createEntity(context, laneData);
                }
                laneEntity.name = lane.name;
                laneEntity.processDef = this;
                yield laneEntity.save(context);
                laneCache[lane.id] = laneEntity;
            }));
            yield Promise.all(lanePromiseArray);
            return laneCache;
        });
    }
    _updateNodes(nodes, laneCache, bpmnDiagram, context) {
        return __awaiter(this, void 0, void 0, function* () {
            const nodeCache = {};
            const NodeDef = yield this.datastoreService.getEntityType('NodeDef');
            const nodePromiseArray = nodes.map((node) => __awaiter(this, void 0, void 0, function* () {
                const queryObject = [
                    { attribute: 'key', operator: '=', value: node.id },
                    { attribute: 'processDef', operator: '=', value: this.id }
                ];
                let nodeDefEntity = yield NodeDef.findOne(context, { query: queryObject });
                if (!nodeDefEntity) {
                    const nodeDefData = {
                        key: node.id
                    };
                    nodeDefEntity = yield NodeDef.createEntity(context, nodeDefData);
                }
                switch (node.$type) {
                    case 'bpmn:ScriptTask':
                        nodeDefEntity.script = node.script || null;
                        break;
                    case 'bpmn:BoundaryEvent':
                        const eventType = (node.eventDefinitions && node.eventDefinitions.length > 0) ? node.eventDefinitions[0].$type : null;
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
                        const subElements = node.flowElements ? node.flowElements : [];
                        const subNodes = subElements.filter((element) => element.$type !== 'bpmn:SequenceFlow');
                        const subFlows = subElements.filter((element) => element.$type === 'bpmn:SequenceFlow');
                        break;
                    default:
                }
                if (node.extensionElements) {
                    const extensions = this._updateExtensionElements(node.extensionElements.values);
                    nodeDefEntity.extensions = extensions;
                }
                nodeDefEntity.name = node.name;
                nodeDefEntity.type = node.$type;
                nodeDefEntity.processDef = this;
                const laneId = bpmnDiagram.getLaneOfElement(node.id);
                if (laneId) {
                    nodeDefEntity.lane = laneCache[laneId];
                }
                yield nodeDefEntity.save(context);
                nodeCache[node.id] = nodeDefEntity;
            }));
            yield Promise.all(nodePromiseArray);
            return nodeCache;
        });
    }
    _updateFlows(flows, nodeCache, context) {
        return __awaiter(this, void 0, void 0, function* () {
            const FlowDef = yield this.datastoreService.getEntityType('FlowDef');
            const flowPromiseArray = flows.map((flow) => __awaiter(this, void 0, void 0, function* () {
                const queryObject = [
                    { attribute: 'key', operator: '=', value: flow.id },
                    { attribute: 'processDef', operator: '=', value: this.id }
                ];
                let flowDefEntity = yield FlowDef.findOne(context, { query: queryObject });
                if (!flowDefEntity) {
                    const flowDefData = {
                        key: flow.id
                    };
                    flowDefEntity = yield FlowDef.createEntity(context, flowDefData);
                }
                flowDefEntity.name = flow.name;
                flowDefEntity.processDef = this;
                if (flow.sourceRef && flow.sourceRef.id) {
                    const sourceId = flow.sourceRef.id;
                    flowDefEntity.source = nodeCache[sourceId];
                }
                if (flow.targetRef && flow.targetRef.id) {
                    const targetId = flow.targetRef.id;
                    flowDefEntity.target = nodeCache[targetId];
                }
                if (flow.conditionExpression && flow.conditionExpression.body) {
                    flowDefEntity.condition = flow.conditionExpression.body;
                }
                yield flowDefEntity.save(context);
            }));
            yield Promise.all(flowPromiseArray);
        });
    }
    _createBoundaries(nodes, nodeCache, context) {
        return __awaiter(this, void 0, void 0, function* () {
            const nodePromiseArray = nodes.map((node) => __awaiter(this, void 0, void 0, function* () {
                if (node.$type === 'bpmn:BoundaryEvent') {
                    const attachedKey = (node.attachedToRef && node.attachedToRef.id) ? node.attachedToRef.id : null;
                    if (attachedKey) {
                        const sourceEnt = nodeCache[attachedKey];
                        const boundary = nodeCache[node.id];
                        boundary.attachedToNode = sourceEnt;
                        yield boundary.save(context);
                        const events = sourceEnt.events || {};
                        switch (boundary.eventType) {
                            case 'bpmn:ErrorEventDefinition':
                                events.error = boundary.key;
                                break;
                            default:
                        }
                        sourceEnt.events = events;
                        yield sourceEnt.save(context);
                    }
                }
            }));
            yield Promise.all(nodePromiseArray);
        });
    }
    _updateExtensionElements(extensionElements) {
        const ext = {};
        extensionElements.forEach((extensionElement) => {
            if (extensionElement.$type === 'camunda:formData') {
                const formFields = [];
                extensionElement.$children.forEach((child) => {
                    const formValues = [];
                    const formProperties = [];
                    child.$children.forEach((formValue) => {
                        const childType = formValue.$type;
                        switch (childType) {
                            case 'camunda:properties':
                                formValue.$children.forEach((child) => {
                                    const newChild = {
                                        $type: child.$type,
                                        name: child.id,
                                        value: child.value
                                    };
                                    formProperties.push(newChild);
                                });
                                break;
                            case 'camunda:value':
                                const newFormValue = {
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
                    const newChild = {
                        $type: child.$type,
                        id: child.id,
                        label: child.label,
                        type: child.type,
                        defaultValue: child.defaultValue,
                        formValues: formValues,
                        formProperties: formProperties
                    };
                    formFields.push(newChild);
                });
                ext.formFields = formFields;
            }
            else if (extensionElement.$type === 'camunda:properties') {
                const properties = [];
                extensionElement.$children.forEach((child) => {
                    const newChild = {
                        $type: child.$type,
                        name: child.name,
                        value: child.value
                    };
                    properties.push(newChild);
                });
                ext.properties = properties;
            }
        });
        return ext;
    }
}
__decorate([
    metadata_1.schemaAttribute({
        type: core_contracts_1.SchemaAttributeType.string,
        onInit: () => {
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
